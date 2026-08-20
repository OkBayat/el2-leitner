import { normalizeVocabularyForm } from "../../../domain/library/VocabularyNormalizer.js";

function emptyResult() {
  return { mastered: 0, pendingCorrected: 0, repairedUsers: 0 };
}

function isSuccessfulFinalReview(row) {
  return row?.review_event_id !== null && row?.review_event_id !== undefined &&
    Number(row.correct) === 1 &&
    Number(row.promoted) === 1 &&
    Number(row.previous_box) === 5 &&
    Number(row.new_box) === 5;
}

function parseForms(value) {
  return [...new Set(
    String(value || "")
      .split("\u001f")
      .map((form) => normalizeVocabularyForm(form))
      .filter(Boolean)
  )];
}

function groupByUser(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = String(row.user_id);
    if (!groups.has(key)) groups.set(key, { userId: row.user_id, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

function newerReview(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  const leftTime = new Date(left.occurred_at).getTime();
  const rightTime = new Date(right.occurred_at).getTime();
  if (rightTime !== leftTime) return rightTime > leftTime ? right : left;
  return Number(right.review_event_id) > Number(left.review_event_id) ? right : left;
}

function addOwner(ownersByForm, normalizedForm, vocabularyEntryId) {
  if (!normalizedForm) return;
  if (!ownersByForm.has(normalizedForm)) ownersByForm.set(normalizedForm, new Set());
  ownersByForm.get(normalizedForm).add(String(vocabularyEntryId));
}

function candidateFormOwners(candidates, persistedOwners) {
  const owners = new Map(
    [...persistedOwners.entries()].map(([form, ids]) => [form, new Set(ids)])
  );
  for (const candidate of candidates) {
    for (const form of parseForms(candidate.forms)) {
      addOwner(owners, form, candidate.vocabulary_entry_id);
    }
  }
  return owners;
}

function fallbackByNormalizedForm(rows) {
  const index = new Map();
  for (const row of rows) {
    const normalized = normalizeVocabularyForm(row.term_snapshot);
    if (!normalized) continue;
    const existing = index.get(normalized);
    index.set(normalized, newerReview(existing, row));
  }
  return index;
}

async function latestExactReview(connection, userId, vocabularyEntryId, learningResetAt) {
  const [rows] = await connection.execute(
    `SELECT id AS review_event_id, occurred_at, local_day, correct, promoted, previous_box, new_box
     FROM review_events
     WHERE user_id = ?
       AND (? IS NULL OR occurred_at > ?)
       AND vocabulary_entry_id = ?
     ORDER BY occurred_at DESC, id DESC
     LIMIT 1`,
    [userId, learningResetAt, learningResetAt, vocabularyEntryId]
  );
  return rows[0] || null;
}

async function loadFallbackReviews(connection, userId, learningResetAt) {
  const [rows] = await connection.execute(
    `SELECT re.id AS review_event_id, re.occurred_at, re.local_day,
            re.correct, re.promoted, re.previous_box, re.new_box, re.term_snapshot
     FROM review_events re
     LEFT JOIN vocabulary_entries event_vocabulary ON event_vocabulary.id = re.vocabulary_entry_id
     WHERE re.user_id = ?
       AND (? IS NULL OR re.occurred_at > ?)
       AND (re.vocabulary_entry_id IS NULL OR event_vocabulary.status <> 'active')
     ORDER BY re.occurred_at DESC, re.id DESC`,
    [userId, learningResetAt, learningResetAt]
  );
  return fallbackByNormalizedForm(rows);
}

async function loadActiveFormOwners(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT vf.normalized_form, ve.id AS vocabulary_entry_id
     FROM vocabulary_entries ve
     JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
     WHERE ve.status = 'active'
       AND (
         ve.owner_user_id = ?
         OR (
           ve.owner_user_id IS NULL
           AND EXISTS (
             SELECT 1
             FROM user_collections uc
             JOIN collections c ON c.id = uc.collection_id AND c.archived_at IS NULL
             JOIN collection_entries ce
               ON ce.collection_id = uc.collection_id
              AND ce.vocabulary_entry_id = ve.id
              AND ce.removed_at IS NULL
             WHERE uc.user_id = ? AND uc.status = 'active'
           )
         )
       )`,
    [userId, userId]
  );
  const owners = new Map();
  for (const row of rows) addOwner(owners, row.normalized_form, row.vocabulary_entry_id);
  return owners;
}

function latestTrustedFallback(candidate, fallbackIndex, ownersByForm) {
  const candidateId = String(candidate.vocabulary_entry_id);
  let latest = null;
  for (const form of parseForms(candidate.forms)) {
    const owners = ownersByForm.get(form);
    if (!owners || owners.size !== 1 || !owners.has(candidateId)) continue;
    latest = newerReview(latest, fallbackIndex.get(form));
  }
  return latest;
}

async function latestRelevantReview(connection, userId, candidate, learningResetAt, fallbackIndex, ownersByForm) {
  // Exact evidence remains indexed. Fallback evidence is normalized in Node with
  // the same domain function used to create vocabulary identities, then the newest
  // trusted event wins because identity drift can happen before the final review.
  const exact = await latestExactReview(connection, userId, candidate.vocabulary_entry_id, learningResetAt);
  const fallback = latestTrustedFallback(candidate, fallbackIndex, ownersByForm);
  return newerReview(exact, fallback);
}

async function lockedProgress(connection, userId, vocabularyEntryId) {
  const [rows] = await connection.execute(
    `SELECT box, due_date, mastered_at
     FROM user_vocabulary_progress
     WHERE user_id = ?
       AND vocabulary_entry_id = ?
       AND status = 'active'
     LIMIT 1
     FOR UPDATE`,
    [userId, vocabularyEntryId]
  );
  return rows[0] || null;
}

function isStuckBoxFive(progress) {
  return Number(progress?.box) === 5 && progress?.due_date !== null && progress?.due_date !== undefined;
}

export async function repairHistoricalBoxFiveProgress(pool) {
  const [candidates] = await pool.execute(`
    SELECT uvp.user_id, uvp.vocabulary_entry_id,
           GROUP_CONCAT(DISTINCT vf.normalized_form ORDER BY vf.is_primary DESC, vf.id SEPARATOR '\u001f') AS forms
    FROM user_vocabulary_progress uvp
    JOIN user_state_revisions usr ON usr.user_id = uvp.user_id
    LEFT JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = uvp.vocabulary_entry_id
    WHERE uvp.status = 'active'
      AND uvp.box = 5
      AND uvp.due_date IS NOT NULL
    GROUP BY uvp.user_id, uvp.vocabulary_entry_id
    ORDER BY uvp.user_id, uvp.vocabulary_entry_id
  `);

  if (!candidates.length) return emptyResult();

  let mastered = 0;
  let pendingCorrected = 0;
  let repairedUsers = 0;

  for (const group of groupByUser(candidates)) {
    const connection = await pool.getConnection();
    let userChanged = false;
    try {
      await connection.beginTransaction();

      // Match the normal learning write lock order: revision first, progress second.
      const [revisionRows] = await connection.execute(
        `SELECT revision, learning_reset_at
         FROM user_state_revisions
         WHERE user_id = ?
         LIMIT 1
         FOR UPDATE`,
        [group.userId]
      );
      const revision = revisionRows[0];
      if (!revision) {
        await connection.commit();
        continue;
      }

      const [fallbackIndex, persistedOwners] = await Promise.all([
        loadFallbackReviews(connection, group.userId, revision.learning_reset_at),
        loadActiveFormOwners(connection, group.userId)
      ]);
      const ownersByForm = candidateFormOwners(group.rows, persistedOwners);

      for (const candidate of group.rows) {
        const progress = await lockedProgress(connection, group.userId, candidate.vocabulary_entry_id);
        if (!isStuckBoxFive(progress)) continue;

        const finalReview = await latestRelevantReview(
          connection,
          group.userId,
          candidate,
          revision.learning_reset_at,
          fallbackIndex,
          ownersByForm
        );

        if (isSuccessfulFinalReview(finalReview)) {
          const [result] = await connection.execute(
            `UPDATE user_vocabulary_progress
             SET due_date = NULL,
                 blocked_until = NULL,
                 mastered_at = ?,
                 last_reviewed_at = ?,
                 last_promoted_on = ?
             WHERE user_id = ?
               AND vocabulary_entry_id = ?
               AND status = 'active'
               AND box = 5
               AND due_date IS NOT NULL`,
            [
              finalReview.occurred_at,
              finalReview.occurred_at,
              finalReview.local_day,
              group.userId,
              candidate.vocabulary_entry_id
            ]
          );
          if (Number(result.affectedRows) > 0) {
            mastered += 1;
            userChanged = true;
          }
          continue;
        }

        if (!progress.mastered_at) continue;
        const [result] = await connection.execute(
          `UPDATE user_vocabulary_progress
           SET mastered_at = NULL
           WHERE user_id = ?
             AND vocabulary_entry_id = ?
             AND status = 'active'
             AND box = 5
             AND due_date IS NOT NULL`,
          [group.userId, candidate.vocabulary_entry_id]
        );
        if (Number(result.affectedRows) > 0) {
          pendingCorrected += 1;
          userChanged = true;
        }
      }

      if (userChanged) {
        await connection.execute(
          `UPDATE user_state_revisions
           SET revision = revision + 1,
               updated_at = CURRENT_TIMESTAMP(3)
           WHERE user_id = ?`,
          [group.userId]
        );
        repairedUsers += 1;
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return { mastered, pendingCorrected, repairedUsers };
}
