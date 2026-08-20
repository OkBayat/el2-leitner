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
  return [...new Set(String(value || "").split("\u001f").map((form) => form.trim()).filter(Boolean))];
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

async function latestRelevantReview(connection, userId, vocabularyEntryId, learningResetAt, forms) {
  const safeForms = parseForms(forms);
  const fallbackClause = safeForms.length
    ? ` OR (
         re.term_snapshot IN (${safeForms.map(() => "?").join(", ")})
         AND (re.vocabulary_entry_id IS NULL OR event_vocabulary.status <> 'active')
         AND NOT EXISTS (
           SELECT 1
           FROM vocabulary_forms ambiguous_form
           JOIN vocabulary_entries ambiguous_vocabulary
             ON ambiguous_vocabulary.id = ambiguous_form.vocabulary_entry_id
            AND ambiguous_vocabulary.status = 'active'
           WHERE ambiguous_vocabulary.id <> ?
             AND ambiguous_form.form = re.term_snapshot
             AND (ambiguous_vocabulary.owner_user_id IS NULL OR ambiguous_vocabulary.owner_user_id = ?)
         )
       )`
    : "";
  const [rows] = await connection.execute(
    `SELECT re.id AS review_event_id, re.occurred_at, re.local_day, re.correct, re.promoted, re.previous_box, re.new_box
     FROM review_events re
     LEFT JOIN vocabulary_entries event_vocabulary ON event_vocabulary.id = re.vocabulary_entry_id
     WHERE re.user_id = ?
       AND (? IS NULL OR re.occurred_at > ?)
       AND (re.vocabulary_entry_id = ?${fallbackClause})
     ORDER BY re.occurred_at DESC, re.id DESC
     LIMIT 1`,
    safeForms.length
      ? [userId, learningResetAt, learningResetAt, vocabularyEntryId, ...safeForms, vocabularyEntryId, userId]
      : [userId, learningResetAt, learningResetAt, vocabularyEntryId]
  );
  return rows[0] || null;
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
           GROUP_CONCAT(DISTINCT vf.form ORDER BY vf.is_primary DESC, vf.id SEPARATOR '\u001f') AS forms
    FROM user_vocabulary_progress uvp
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

      // Normal learning writes lock the revision first. Keep the same lock order so
      // a deployment repair cannot deadlock with a still-running older app process.
      const [revisionRows] = await connection.execute(
        `SELECT revision, learning_reset_at
         FROM user_state_revisions
         WHERE user_id = ?
         LIMIT 1
         FOR UPDATE`,
        [group.userId]
      );
      const revision = revisionRows[0];
      if (!revision) throw new Error(`Missing learning-state revision for user ${group.userId}`);

      for (const candidate of group.rows) {
        const progress = await lockedProgress(connection, group.userId, candidate.vocabulary_entry_id);
        if (!isStuckBoxFive(progress)) continue;

        const finalReview = await latestRelevantReview(
          connection,
          group.userId,
          candidate.vocabulary_entry_id,
          revision.learning_reset_at,
          candidate.forms
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
