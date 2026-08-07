import {
  cleanVocabularyForms,
  normalizeVocabularyForm
} from "../../../domain/library/VocabularyNormalizer.js";
import { needsProgressRow } from "./MySqlLearningStateRepository.js";

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  return typeof value === "string" ? JSON.parse(value) : value;
}

function nonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function boxNumber(value) {
  return Math.min(5, nonNegativeInteger(value));
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function asDay(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const date = asDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function latestByReview(words) {
  return [...words].sort((left, right) => {
    const leftReviewed = asDate(left?.lastReviewed)?.valueOf() ?? -1;
    const rightReviewed = asDate(right?.lastReviewed)?.valueOf() ?? -1;
    if (leftReviewed !== rightReviewed) return rightReviewed - leftReviewed;
    const leftActive = boxNumber(left?.box) > 0 || nonNegativeInteger(left?.attempts) > 0 ? 1 : 0;
    const rightActive = boxNumber(right?.box) > 0 || nonNegativeInteger(right?.attempts) > 0 ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    return boxNumber(right?.box) - boxNumber(left?.box);
  })[0];
}

function earliestDay(values) {
  return values.map(asDay).filter(Boolean).sort()[0] || null;
}

function uniqueNotes(words) {
  const notes = [...new Set(words.map((word) => String(word?.notes || "").trim()).filter(Boolean))];
  return notes.join("\n").slice(0, 10_000) || null;
}

export function mergeLegacyProgressGroup(words) {
  if (!Array.isArray(words) || !words.length) return null;
  const representative = latestByReview(words);
  const lastReviewed = words
    .map((word) => asDate(word?.lastReviewed))
    .filter(Boolean)
    .sort((left, right) => right - left)[0] || null;
  const lastPromotedDay = words.map((word) => asDay(word?.lastPromotedDay)).filter(Boolean).sort().at(-1) || null;
  const blockedUntil = words.map((word) => asDay(word?.blockedUntil)).filter(Boolean).sort().at(-1) || null;
  const masteredAt = words
    .map((word) => asDate(word?.masteredAt))
    .filter(Boolean)
    .sort((left, right) => right - left)[0] || null;

  return {
    box: boxNumber(representative?.box),
    due: asDay(representative?.due) || earliestDay(words.map((word) => word?.due)),
    attempts: words.reduce((sum, word) => sum + nonNegativeInteger(word?.attempts), 0),
    correct: words.reduce((sum, word) => sum + nonNegativeInteger(word?.correct), 0),
    mistakes: words.reduce((sum, word) => sum + nonNegativeInteger(word?.mistakes), 0),
    currentStreak: Math.max(...words.map((word) => nonNegativeInteger(word?.currentStreak))),
    introducedOn: earliestDay(words.map((word) => word?.introducedOn)),
    addedSource: representative?.addedSource ? String(representative.addedSource).slice(0, 64) : null,
    lastReviewed,
    lastPromotedDay,
    blockedUntil,
    masteredAt,
    notes: uniqueNotes(words),
    category: String(representative?.category || "").trim().slice(0, 255) || null
  };
}

function vocabularyIdForWord(word, vocabularyByForm) {
  const forms = cleanVocabularyForms(word?.term, word?.accepted);
  for (const form of forms) {
    const id = vocabularyByForm.get(normalizeVocabularyForm(form.form));
    if (id) return id;
  }
  return null;
}

async function loadDefaultVocabularyMap(pool) {
  const [rows] = await pool.execute(
    `SELECT ce.vocabulary_entry_id, vf.normalized_form
     FROM collections c
     JOIN collection_entries ce ON ce.collection_id = c.id AND ce.removed_at IS NULL
     JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ce.vocabulary_entry_id
     WHERE c.is_default = TRUE AND c.archived_at IS NULL`
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.normalized_form)) map.set(row.normalized_form, row.vocabulary_entry_id);
  }
  return map;
}

export async function repairLegacyAliasProgress(pool) {
  const vocabularyByForm = await loadDefaultVocabularyMap(pool);
  const [legacyRows] = await pool.execute(
    `SELECT ls.user_id, ls.state_json
     FROM learning_states ls
     JOIN user_state_revisions usr ON usr.user_id = ls.user_id
     WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(usr.metadata_json, '$.legacyAliasProgressMerged')), 'false') NOT IN ('true', '1')
     ORDER BY ls.user_id`
  );

  let repairedUsers = 0;
  let repairedGroups = 0;
  for (const legacyRow of legacyRows) {
    const state = parseJson(legacyRow.state_json, {}) || {};
    const groups = new Map();
    for (const word of Array.isArray(state.words) ? state.words : []) {
      const vocabularyId = vocabularyIdForWord(word, vocabularyByForm);
      if (!vocabularyId) continue;
      const key = String(vocabularyId);
      if (!groups.has(key)) groups.set(key, { vocabularyId, words: [] });
      groups.get(key).words.push(word);
    }

    const duplicateGroups = [...groups.values()].filter((group) => group.words.length > 1);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const group of duplicateGroups) {
        const merged = mergeLegacyProgressGroup(group.words);
        const shouldStore = group.words.some((word) => needsProgressRow(word, {
          personalMembership: false,
          catalogCategories: [word?.category].filter(Boolean)
        }));
        if (!shouldStore) {
          await connection.execute(
            "DELETE FROM user_vocabulary_progress WHERE user_id = ? AND vocabulary_entry_id = ?",
            [legacyRow.user_id, group.vocabularyId]
          );
          repairedGroups += 1;
          continue;
        }
        await connection.execute(
          `INSERT INTO user_vocabulary_progress
             (user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count, mistake_count,
              current_streak, introduced_on, introduced_via, last_reviewed_at, last_promoted_on,
              blocked_until, mastered_at, personal_note, legacy_category)
           VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = 'active', box = VALUES(box), due_date = VALUES(due_date),
             attempts = VALUES(attempts), correct_count = VALUES(correct_count), mistake_count = VALUES(mistake_count),
             current_streak = VALUES(current_streak), introduced_on = VALUES(introduced_on), introduced_via = VALUES(introduced_via),
             last_reviewed_at = VALUES(last_reviewed_at), last_promoted_on = VALUES(last_promoted_on),
             blocked_until = VALUES(blocked_until), mastered_at = VALUES(mastered_at),
             personal_note = VALUES(personal_note), legacy_category = COALESCE(legacy_category, VALUES(legacy_category))`,
          [
            legacyRow.user_id,
            group.vocabularyId,
            merged.box,
            merged.due,
            merged.attempts,
            merged.correct,
            merged.mistakes,
            merged.currentStreak,
            merged.introducedOn,
            merged.addedSource,
            merged.lastReviewed,
            merged.lastPromotedDay,
            merged.blockedUntil,
            merged.masteredAt,
            merged.notes,
            merged.category
          ]
        );
        repairedGroups += 1;
      }
      await connection.execute(
        `UPDATE user_state_revisions
         SET metadata_json = JSON_SET(COALESCE(metadata_json, JSON_OBJECT()), '$.legacyAliasProgressMerged', true)
         WHERE user_id = ?`,
        [legacyRow.user_id]
      );
      await connection.commit();
      repairedUsers += 1;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return { repairedUsers, repairedGroups };
}
