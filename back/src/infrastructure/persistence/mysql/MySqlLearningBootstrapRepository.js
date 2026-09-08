import { normalizeVocabularyForm } from "../../../domain/library/VocabularyNormalizer.js";
import { reviewFingerprint } from "./MySqlEfficientLearningStateRepository.js";

const DEFAULT_SETTINGS = Object.freeze({ dailyNew: 10, dailyGoal: 20, dailyListeningGoal: 3, voiceRate: 0.85, theme: "light" });
const REQUIRED_WORD_KEYS = new Set(["id", "number", "term", "accepted", "category", "tags", "lessons", "notes", "createdAt"]);

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  return typeof value === "string" ? JSON.parse(value) : value;
}

function splitLabels(value) {
  if (!value) return [];
  return [...new Set(String(value).split("\u001f").map((item) => item.trim()).filter(Boolean))];
}

function asDay(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  return null;
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function boxNumber(value) {
  return Math.min(5, nonNegativeInteger(value));
}

function compactWord(word) {
  return Object.fromEntries(Object.entries(word).filter(([key, value]) => {
    if (REQUIRED_WORD_KEYS.has(key)) return true;
    return value !== null && value !== "" && value !== 0;
  }));
}

function localHistoryCursor(history) {
  const events = Array.isArray(history) ? history : [];
  return {
    historyLength: events.length,
    lastReviewFingerprint: events.length ? reviewFingerprint(events.at(-1)) : null
  };
}

function compactExistingResult(result) {
  if (!result?.state) return result;
  const history = Array.isArray(result.state.history) ? result.state.history.slice(-1) : [];
  return {
    revision: result.revision,
    state: {
      ...result.state,
      words: Array.isArray(result.state.words) ? result.state.words.map(compactWord) : [],
      history,
      normalizedPersistenceVersion: 2,
      persistenceCursor: localHistoryCursor(history)
    }
  };
}

export class MySqlLearningBootstrapRepository {
  constructor(pool, fallbackRepository) {
    this.pool = pool;
    this.fallbackRepository = fallbackRepository;
  }

  async findByUserId(userId) {
    const [revisionRows] = await this.pool.execute(
      "SELECT revision, state_created_at, metadata_json, learning_reset_at, created_at, updated_at FROM user_state_revisions WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const revisionRow = revisionRows[0];
    if (!revisionRow) {
      return compactExistingResult(await this.fallbackRepository.findByUserId(userId));
    }

    const [settingsRows, dailyRows, wordRows, eventRows, subscriptionRows] = await Promise.all([
      this.pool.execute(
        "SELECT daily_new, daily_goal, daily_listening_goal, voice_rate, theme FROM user_settings WHERE user_id = ? LIMIT 1",
        [userId]
      ),
      this.pool.execute(
        `SELECT day, attempts, correct_count, wrong_count, new_added, session_count, duration_seconds
         FROM user_daily_stats WHERE user_id = ? ORDER BY day`,
        [userId]
      ),
      this.pool.execute(
        `SELECT ve.public_id, ve.primary_form,
                GROUP_CONCAT(DISTINCT vf.form ORDER BY vf.form SEPARATOR '\u001f') AS accepted_forms,
                MIN(CASE WHEN source.user_id IS NOT NULL AND source.is_default THEN 0 WHEN source.user_id IS NOT NULL THEN 1 ELSE 2 END) AS source_priority,
                MIN(source.subscribed_at) AS source_subscribed_at,
                MIN(source.position) AS source_position,
                COALESCE(MAX(uvp.legacy_category), MIN(s.title), 'بدون دسته‌بندی') AS category,
                GROUP_CONCAT(
                  DISTINCT COALESCE(parent_section.title, s.title)
                  ORDER BY COALESCE(parent_section.title, s.title)
                  SEPARATOR '\u001f'
                ) AS lessons,
                GROUP_CONCAT(
                  DISTINCT CASE WHEN parent_section.id IS NOT NULL THEN s.title END
                  ORDER BY s.title
                  SEPARATOR '\u001f'
                ) AS tags,
                MAX(uvp.personal_note) AS personal_note,
                MAX(uvp.box) AS box, MAX(uvp.due_date) AS due_date,
                MAX(uvp.attempts) AS attempts, MAX(uvp.correct_count) AS correct_count,
                MAX(uvp.mistake_count) AS mistake_count, MAX(uvp.current_streak) AS current_streak,
                MAX(uvp.introduced_on) AS introduced_on, MAX(uvp.introduced_via) AS introduced_via,
                MAX(uvp.last_reviewed_at) AS last_reviewed_at, MAX(uvp.last_promoted_on) AS last_promoted_on,
                MAX(uvp.blocked_until) AS blocked_until, MAX(uvp.mastered_at) AS mastered_at,
                MIN(ve.created_at) AS progress_created_at
         FROM vocabulary_entries ve
         LEFT JOIN (
           SELECT uc.user_id, uc.subscribed_at, c.is_default,
                  ce.vocabulary_entry_id, ce.position, ce.section_id
           FROM user_collections uc
           JOIN collections c ON c.id = uc.collection_id
           JOIN collection_entries ce ON ce.collection_id = c.id AND ce.removed_at IS NULL
           WHERE uc.user_id = ? AND uc.status = 'active'
         ) source ON source.vocabulary_entry_id = ve.id
         LEFT JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
         LEFT JOIN collection_sections s ON s.id = source.section_id
         LEFT JOIN collection_sections parent_section ON parent_section.id = s.parent_section_id
         LEFT JOIN user_vocabulary_progress uvp
           ON uvp.user_id = ? AND uvp.vocabulary_entry_id = ve.id
         WHERE ve.status = 'active'
           AND (
             source.user_id IS NOT NULL
             OR (uvp.user_id IS NOT NULL AND uvp.introduced_via = 'learning-path')
           )
           AND COALESCE(uvp.status, 'active') <> 'excluded'
         GROUP BY ve.id
         ORDER BY source_priority, source_subscribed_at, source_position, ve.id`,
        [userId, userId]
      ),
      this.pool.execute(
        `SELECT re.occurred_at, re.local_day, re.answer, re.correct, re.mode,
                re.previous_box, re.new_box, re.promoted, re.mistake_number, re.term_snapshot,
                ve.public_id AS vocabulary_public_id
         FROM review_events re
         LEFT JOIN vocabulary_entries ve ON ve.id = re.vocabulary_entry_id
         WHERE re.user_id = ? AND (? IS NULL OR re.occurred_at > ?)
         ORDER BY re.occurred_at DESC, re.id DESC
         LIMIT 1`,
        [userId, revisionRow.learning_reset_at, revisionRow.learning_reset_at]
      ),
      this.pool.execute(
        `SELECT c.public_id, c.content_version
         FROM user_collections uc
         JOIN collections c ON c.id = uc.collection_id
         WHERE uc.user_id = ? AND uc.status = 'active'`,
        [userId]
      )
    ]);

    const metadata = parseJson(revisionRow.metadata_json, {}) || {};
    const settingsRow = settingsRows[0][0];
    const history = eventRows[0].map((row) => ({
      at: asIso(row.occurred_at),
      day: asDay(row.local_day),
      wordId: row.vocabulary_public_id || null,
      term: row.term_snapshot,
      answer: row.answer || "",
      correct: Boolean(row.correct),
      mode: row.mode || "legacy",
      promoted: Boolean(row.promoted),
      previousBox: row.previous_box === null ? null : Number(row.previous_box),
      newBox: row.new_box === null ? null : Number(row.new_box),
      mistakeNumber: row.mistake_number === null ? null : Number(row.mistake_number)
    })).reverse();

    const state = {
      ...metadata,
      schemaVersion: Number(metadata.schemaVersion) || 2,
      createdAt: metadata.createdAt || asIso(revisionRow.state_created_at) || asIso(revisionRow.created_at),
      updatedAt: asIso(revisionRow.updated_at) || metadata.updatedAt || new Date().toISOString(),
      normalizedPersistenceVersion: 2,
      libraryVersions: Object.fromEntries(
        subscriptionRows[0].map((row) => [row.public_id, Number(row.content_version)])
      ),
      settings: settingsRow
        ? {
            dailyNew: Number(settingsRow.daily_new),
            dailyGoal: Number(settingsRow.daily_goal),
            dailyListeningGoal: Number(settingsRow.daily_listening_goal) || 3,
            voiceRate: Number(settingsRow.voice_rate),
            theme: settingsRow.theme
          }
        : { ...DEFAULT_SETTINGS },
      words: wordRows[0].map((row, index) => compactWord({
        id: row.public_id,
        number: index + 1,
        term: row.primary_form,
        accepted: [
          row.primary_form,
          ...String(row.accepted_forms || "")
            .split("\u001f")
            .filter(Boolean)
            .filter((form) => normalizeVocabularyForm(form) !== normalizeVocabularyForm(row.primary_form))
        ],
        category: row.category || "بدون دسته‌بندی",
        tags: splitLabels(row.tags),
        lessons: splitLabels(row.lessons),
        notes: row.personal_note || "",
        createdAt: asIso(row.progress_created_at) || new Date().toISOString(),
        box: boxNumber(row.box),
        due: asDay(row.due_date),
        attempts: nonNegativeInteger(row.attempts),
        correct: nonNegativeInteger(row.correct_count),
        mistakes: nonNegativeInteger(row.mistake_count),
        currentStreak: nonNegativeInteger(row.current_streak),
        introducedOn: asDay(row.introduced_on),
        addedSource: row.introduced_via || null,
        lastReviewed: asIso(row.last_reviewed_at),
        lastPromotedDay: asDay(row.last_promoted_on),
        blockedUntil: asDay(row.blocked_until),
        masteredAt: asIso(row.mastered_at)
      })),
      daily: Object.fromEntries(dailyRows[0].map((row) => [
        asDay(row.day),
        {
          attempts: Number(row.attempts),
          correct: Number(row.correct_count),
          wrong: Number(row.wrong_count),
          newAdded: Number(row.new_added),
          sessions: Number(row.session_count),
          durationSeconds: Number(row.duration_seconds)
        }
      ])),
      history,
      persistenceCursor: localHistoryCursor(history)
    };

    return { state, revision: Number(revisionRow.revision) };
  }
}
