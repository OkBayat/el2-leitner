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

function hasExistingLearningProgress(target) {
  if (target.progress_user_id === null || target.progress_user_id === undefined) return false;
  return target.progress_status === "active"
    || Number(target.progress_box) > 0
    || Boolean(target.progress_introduced_on);
}

export class MySqlVocabularyActivationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async activate(userId, { expectedRevision, vocabularyId, day }) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [revisionRows] = await connection.execute(
        "SELECT revision FROM user_state_revisions WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      const revisionRow = revisionRows[0];
      if (!revisionRow) {
        throw new NotFoundError("LEARNING_STATE_NOT_FOUND", "Learning state was not found.");
      }

      const currentRevision = Number(revisionRow.revision);
      const [targetRows] = await connection.execute(
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
      const target = targetRows[0];
      if (!target) {
        throw new NotFoundError(
          "VOCABULARY_NOT_FOUND",
          "Vocabulary entry was not found in an active collection."
        );
      }

      if (currentRevision === expectedRevision + 1 && isSameActivation(target, day)) {
        await connection.commit();
        return currentRevision;
      }
      if (currentRevision !== expectedRevision) {
        throw new ConflictError(
          "STATE_CONFLICT",
          "Learning state was updated by another session. Reload and try again."
        );
      }
      if (hasExistingLearningProgress(target)) {
        throw new ConflictError(
          "VOCABULARY_ALREADY_ACTIVE",
          "Vocabulary is already active in the learning boxes."
        );
      }

      await connection.execute(
        `INSERT INTO user_vocabulary_progress
           (user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count, mistake_count,
            current_streak, introduced_on, introduced_via, last_reviewed_at, last_promoted_on,
            blocked_until, mastered_at)
         VALUES (?, ?, 'active', 1, ?, 0, 0, 0, 0, ?, 'word-bank', NULL, NULL, NULL, NULL)
         ON DUPLICATE KEY UPDATE
           status = 'active', box = 1, due_date = VALUES(due_date), attempts = 0,
           correct_count = 0, mistake_count = 0, current_streak = 0,
           introduced_on = VALUES(introduced_on), introduced_via = 'word-bank',
           last_reviewed_at = NULL, last_promoted_on = NULL, blocked_until = NULL, mastered_at = NULL`,
        [userId, target.vocabulary_entry_id, day, day]
      );

      await connection.execute(
        `INSERT INTO user_daily_stats (user_id, day, new_added)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE new_added = new_added + 1`,
        [userId, day]
      );

      await connection.execute(
        "UPDATE user_state_revisions SET revision = revision + 1 WHERE user_id = ?",
        [userId]
      );
      await connection.commit();
      return currentRevision + 1;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
