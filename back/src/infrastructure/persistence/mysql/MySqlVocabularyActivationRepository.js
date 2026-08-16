import { ConflictError, NotFoundError } from "../../../domain/errors.js";

function dayValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isSameActivation(target, day) {
  return target.progress_user_id !== null
    && target.progress_user_id !== undefined
    && target.progress_status === "active"
    && Number(target.progress_box) === 1
    && dayValue(target.progress_due_date) === day
    && dayValue(target.progress_introduced_on) === day
    && target.progress_introduced_via === "word-bank";
}

export class MySqlVocabularyActivationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async currentRevision(connection, userId) {
    const [rows] = await connection.execute(
      "SELECT revision FROM user_state_revisions WHERE user_id = ? LIMIT 1",
      [userId]
    );
    return rows[0] ? Number(rows[0].revision) : null;
  }

  async activationTarget(connection, userId, vocabularyId) {
    const [rows] = await connection.execute(
      `SELECT ve.id AS vocabulary_entry_id,
              uvp.user_id AS progress_user_id,
              uvp.status AS progress_status,
              uvp.box AS progress_box,
              uvp.due_date AS progress_due_date,
              uvp.introduced_on AS progress_introduced_on,
              uvp.introduced_via AS progress_introduced_via
       FROM vocabulary_entries ve
       JOIN collection_entries ce
         ON ce.vocabulary_entry_id = ve.id AND ce.removed_at IS NULL
       JOIN user_collections uc
         ON uc.collection_id = ce.collection_id AND uc.user_id = ? AND uc.status = 'active'
       JOIN collections c ON c.id = ce.collection_id AND c.archived_at IS NULL
       LEFT JOIN user_vocabulary_progress uvp
         ON uvp.user_id = ? AND uvp.vocabulary_entry_id = ve.id
       WHERE ve.public_id = ? AND ve.status = 'active'
       ORDER BY c.is_default DESC, ce.collection_id
       LIMIT 1`,
      [userId, userId, vocabularyId]
    );
    return rows[0] || null;
  }

  async activate(userId, { expectedRevision, vocabularyId, day }) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // Claim the revision first. This is both the optimistic-concurrency check and
      // the only per-user lock on the hot path, so the lock is held for the minimum
      // possible time and we avoid a separate SELECT ... FOR UPDATE round trip.
      const [revisionUpdate] = await connection.execute(
        `UPDATE user_state_revisions
         SET revision = revision + 1
         WHERE user_id = ? AND revision = ?`,
        [userId, expectedRevision]
      );

      if (Number(revisionUpdate.affectedRows) !== 1) {
        const current = await this.currentRevision(connection, userId);
        if (current === null) {
          throw new NotFoundError("LEARNING_STATE_NOT_FOUND", "Learning state was not found.");
        }

        if (current === expectedRevision + 1) {
          const retriedTarget = await this.activationTarget(connection, userId, vocabularyId);
          if (retriedTarget && isSameActivation(retriedTarget, day)) {
            await connection.commit();
            return current;
          }
        }

        throw new ConflictError(
          "STATE_CONFLICT",
          "Learning state was updated by another session. Reload and try again."
        );
      }

      // Resolve and mutate the selected vocabulary in one indexed INSERT ... SELECT.
      // Existing metadata-only box-zero rows are eligible; already-active progress is
      // excluded by the WHERE predicate instead of being overwritten.
      const [progressWrite] = await connection.execute(
        `INSERT INTO user_vocabulary_progress
           (user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count, mistake_count,
            current_streak, introduced_on, introduced_via, last_reviewed_at, last_promoted_on,
            blocked_until, mastered_at)
         SELECT ?, ve.id, 'active', 1, ?, 0, 0, 0, 0, ?, 'word-bank', NULL, NULL, NULL, NULL
         FROM vocabulary_entries ve
         JOIN collection_entries ce
           ON ce.vocabulary_entry_id = ve.id AND ce.removed_at IS NULL
         JOIN user_collections uc
           ON uc.collection_id = ce.collection_id AND uc.user_id = ? AND uc.status = 'active'
         JOIN collections c ON c.id = ce.collection_id AND c.archived_at IS NULL
         LEFT JOIN user_vocabulary_progress existing
           ON existing.user_id = ? AND existing.vocabulary_entry_id = ve.id
         WHERE ve.public_id = ?
           AND ve.status = 'active'
           AND (existing.user_id IS NULL OR (existing.box = 0 AND existing.introduced_on IS NULL))
         ORDER BY c.is_default DESC, ce.collection_id
         LIMIT 1
         ON DUPLICATE KEY UPDATE
           status = 'active', box = 1, due_date = VALUES(due_date), attempts = 0,
           correct_count = 0, mistake_count = 0, current_streak = 0,
           introduced_on = VALUES(introduced_on), introduced_via = 'word-bank',
           last_reviewed_at = NULL, last_promoted_on = NULL, blocked_until = NULL, mastered_at = NULL`,
        [userId, day, day, userId, userId, vocabularyId]
      );

      if (Number(progressWrite.affectedRows) === 0) {
        const target = await this.activationTarget(connection, userId, vocabularyId);
        if (!target) {
          throw new NotFoundError(
            "VOCABULARY_NOT_FOUND",
            "Vocabulary entry was not found in an active collection."
          );
        }
        throw new ConflictError(
          "VOCABULARY_ALREADY_ACTIVE",
          "Vocabulary is already active in the learning boxes."
        );
      }

      await connection.execute(
        `INSERT INTO user_daily_stats (user_id, day, new_added)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE new_added = new_added + 1`,
        [userId, day]
      );

      await connection.commit();
      return expectedRevision + 1;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
