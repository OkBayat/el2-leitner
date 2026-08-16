import { ConflictError, NotFoundError } from "../../../domain/errors.js";

function dayValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isSameActivation(target, day, source = "word-bank") {
  return target.progress_user_id !== null
    && target.progress_user_id !== undefined
    && target.progress_status === "active"
    && Number(target.progress_box) === 1
    && dayValue(target.progress_due_date) === day
    && dayValue(target.progress_introduced_on) === day
    && target.progress_introduced_via === source;
}

function isUnseenProgress(target) {
  return target.progress_user_id === null
    || target.progress_user_id === undefined
    || (Number(target.progress_box) === 0 && !target.progress_introduced_on);
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
              ve.public_id AS vocabulary_id,
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

  async activationTargets(connection, userId, vocabularyIds) {
    if (!vocabularyIds.length) return [];
    const placeholders = vocabularyIds.map(() => "?").join(", ");
    const [rows] = await connection.execute(
      `SELECT DISTINCT ve.id AS vocabulary_entry_id,
              ve.public_id AS vocabulary_id,
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
       WHERE ve.public_id IN (${placeholders}) AND ve.status = 'active'`,
      [userId, userId, ...vocabularyIds]
    );
    return rows;
  }

  async claimRevision(connection, userId, expectedRevision) {
    const [result] = await connection.execute(
      `UPDATE user_state_revisions
       SET revision = revision + 1
       WHERE user_id = ? AND revision = ?`,
      [userId, expectedRevision]
    );
    return Number(result.affectedRows) === 1;
  }

  async activate(userId, { expectedRevision, vocabularyId, day }) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      if (!(await this.claimRevision(connection, userId, expectedRevision))) {
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

  async activateBatch(userId, { expectedRevision, vocabularyIds, day, source }) {
    const connection = await this.pool.getConnection();
    let transactionStarted = false;
    try {
      const targets = await this.activationTargets(connection, userId, vocabularyIds);
      const byPublicId = new Map(targets.map((target) => [String(target.vocabulary_id), target]));
      const missing = vocabularyIds.find((id) => !byPublicId.has(String(id)));
      if (missing) {
        throw new NotFoundError(
          "VOCABULARY_NOT_FOUND",
          "Vocabulary entry was not found in an active collection."
        );
      }

      await connection.beginTransaction();
      transactionStarted = true;
      if (!(await this.claimRevision(connection, userId, expectedRevision))) {
        const current = await this.currentRevision(connection, userId);
        if (current === null) {
          throw new NotFoundError("LEARNING_STATE_NOT_FOUND", "Learning state was not found.");
        }

        if (current === expectedRevision + 1) {
          const retriedTargets = await this.activationTargets(connection, userId, vocabularyIds);
          const retriedById = new Map(retriedTargets.map((target) => [String(target.vocabulary_id), target]));
          if (vocabularyIds.every((id) => {
            const target = retriedById.get(String(id));
            return target && isSameActivation(target, day, source);
          })) {
            await connection.commit();
            transactionStarted = false;
            return current;
          }
        }

        throw new ConflictError(
          "STATE_CONFLICT",
          "Learning state was updated by another session. Reload and try again."
        );
      }

      if (vocabularyIds.some((id) => !isUnseenProgress(byPublicId.get(String(id))))) {
        throw new ConflictError(
          "VOCABULARY_ALREADY_ACTIVE",
          "Vocabulary is already active in the learning boxes."
        );
      }

      const orderedTargets = vocabularyIds.map((id) => byPublicId.get(String(id)));
      const rowSql = orderedTargets.map(() => "(?, ?, 'active', 1, ?, 0, 0, 0, 0, ?, ?, NULL, NULL, NULL, NULL)").join(", ");
      const parameters = orderedTargets.flatMap((target) => [
        userId,
        target.vocabulary_entry_id,
        day,
        day,
        source
      ]);
      await connection.execute(
        `INSERT INTO user_vocabulary_progress
           (user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count, mistake_count,
            current_streak, introduced_on, introduced_via, last_reviewed_at, last_promoted_on,
            blocked_until, mastered_at)
         VALUES ${rowSql}
         ON DUPLICATE KEY UPDATE
           status = 'active', box = 1, due_date = VALUES(due_date), attempts = 0,
           correct_count = 0, mistake_count = 0, current_streak = 0,
           introduced_on = VALUES(introduced_on), introduced_via = VALUES(introduced_via),
           last_reviewed_at = NULL, last_promoted_on = NULL, blocked_until = NULL, mastered_at = NULL`,
        parameters
      );

      await connection.execute(
        `INSERT INTO user_daily_stats (user_id, day, new_added)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE new_added = new_added + VALUES(new_added)`,
        [userId, day, vocabularyIds.length]
      );

      await connection.commit();
      transactionStarted = false;
      return expectedRevision + 1;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
