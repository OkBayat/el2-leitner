import { LearningPathProgressWriter } from "../../../../application/collection-learning-path/ports/LearningPathProgressWriter.js";

const executor = (pool, options) => options?.connection ?? pool;

function timestampParameter(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Learning Path progress timestamp must be a valid date.");
  }
  return date;
}

export class MySqlLearningPathProgressCommandRepository extends LearningPathProgressWriter {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async removePathEnrollment(userId, pathPublicId, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `UPDATE user_learning_path_progress up
       JOIN collection_learning_paths p ON p.id = up.learning_path_id
       SET up.enrollment_status = 'removed',
           up.enrollment_removed_at = CURRENT_TIMESTAMP(3),
           up.revision = up.revision + 1
       WHERE up.user_id = ? AND p.public_id = ? AND up.enrollment_status = 'active'`,
      [userId, pathPublicId],
    );
    return { changed: result.affectedRows > 0 };
  }

  async upsertPathProgress(progress, options = {}) {
    const db = executor(this.pool, options);
    const expectedRevision = progress.expectedRevision;
    if (expectedRevision == null) {
      const [result] = await db.execute(
        `INSERT INTO user_learning_path_progress
          (user_id, learning_path_id, status, started_at, completed_at, last_activity_at, last_seen_content_version, revision)
         SELECT ?, p.id, ?, ?, ?, ?, ?, 0
         FROM collection_learning_paths p
         WHERE p.public_id = ?
         ON DUPLICATE KEY UPDATE
           status = IF(enrollment_status = 'removed', user_learning_path_progress.status, VALUES(status)),
           started_at = LEAST(started_at, VALUES(started_at)),
           completed_at = IF(enrollment_status = 'removed', completed_at, VALUES(completed_at)),
           last_activity_at = IF(enrollment_status = 'removed', last_activity_at, GREATEST(last_activity_at, VALUES(last_activity_at))),
           last_seen_content_version = GREATEST(last_seen_content_version, VALUES(last_seen_content_version)),
           enrollment_status = 'active',
           enrollment_removed_at = NULL,
           revision = revision + 1`,
        [
          progress.userId,
          progress.status,
          timestampParameter(progress.startedAt),
          timestampParameter(progress.completedAt),
          timestampParameter(progress.lastActivityAt),
          progress.lastSeenContentVersion ?? 0,
          progress.pathId,
        ],
      );
      return { changed: result.affectedRows > 0, conflict: false };
    }

    const expected = Number(expectedRevision);
    const [result] = await db.execute(
      `INSERT INTO user_learning_path_progress
        (user_id, learning_path_id, status, started_at, completed_at, last_activity_at, last_seen_content_version, revision)
       SELECT ?, p.id, ?, ?, ?, ?, ?, 1
       FROM collection_learning_paths p
       WHERE p.public_id = ?
       ON DUPLICATE KEY UPDATE
         status = IF(user_learning_path_progress.revision = ?, VALUES(status), user_learning_path_progress.status),
         started_at = IF(user_learning_path_progress.revision = ?, LEAST(user_learning_path_progress.started_at, VALUES(started_at)), user_learning_path_progress.started_at),
         completed_at = IF(user_learning_path_progress.revision = ?, VALUES(completed_at), user_learning_path_progress.completed_at),
         last_activity_at = IF(user_learning_path_progress.revision = ?, GREATEST(user_learning_path_progress.last_activity_at, VALUES(last_activity_at)), user_learning_path_progress.last_activity_at),
         last_seen_content_version = IF(user_learning_path_progress.revision = ?, GREATEST(user_learning_path_progress.last_seen_content_version, VALUES(last_seen_content_version)), user_learning_path_progress.last_seen_content_version),
         enrollment_status = IF(user_learning_path_progress.revision = ?, 'active', user_learning_path_progress.enrollment_status),
         enrollment_removed_at = IF(user_learning_path_progress.revision = ?, NULL, user_learning_path_progress.enrollment_removed_at),
         revision = IF(user_learning_path_progress.revision = ?, user_learning_path_progress.revision + 1, user_learning_path_progress.revision)`,
      [
        progress.userId,
        progress.status,
        timestampParameter(progress.startedAt),
        timestampParameter(progress.completedAt),
        timestampParameter(progress.lastActivityAt),
        progress.lastSeenContentVersion ?? 0,
        progress.pathId,
        expected,
        expected,
        expected,
        expected,
        expected,
        expected,
        expected,
        expected,
      ],
    );
    // INSERT means no prior progress row. Only revision 0 is valid in that case;
    // a higher expected revision is stale and the enclosing transaction rolls it back.
    const insertedWithStaleRevision = result.affectedRows === 1 && expected !== 0;
    const conflict = result.affectedRows === 0 || insertedWithStaleRevision;
    return { changed: !conflict, conflict, revision: conflict ? expected : expected + 1 };
  }

  async upsertLessonProgress(progress, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `INSERT INTO user_learning_path_lesson_progress
        (user_id, lesson_id, status, started_at, completed_at, last_activity_at)
       SELECT ?, l.id, ?, ?, ?, ?
       FROM learning_path_lessons l
       WHERE l.public_id = ?
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         started_at = LEAST(started_at, VALUES(started_at)),
         completed_at = VALUES(completed_at),
         last_activity_at = GREATEST(last_activity_at, VALUES(last_activity_at))`,
      [
        progress.userId,
        progress.status,
        timestampParameter(progress.startedAt),
        timestampParameter(progress.completedAt),
        timestampParameter(progress.lastActivityAt),
        progress.lessonId,
      ],
    );
    return { changed: result.affectedRows > 0 };
  }

  async upsertExerciseProgress(progress, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `INSERT INTO user_learning_path_exercise_progress
        (user_id, exercise_id, status, started_at, completed_at, last_activity_at, evidence_type, evidence_ref)
       SELECT ?, e.id, ?, ?, ?, ?, ?, ?
       FROM learning_path_exercises e
       WHERE e.public_id = ?
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         started_at = LEAST(started_at, VALUES(started_at)),
         completed_at = VALUES(completed_at),
         last_activity_at = GREATEST(last_activity_at, VALUES(last_activity_at)),
         evidence_type = VALUES(evidence_type),
         evidence_ref = VALUES(evidence_ref)`,
      [
        progress.userId,
        progress.status,
        timestampParameter(progress.startedAt),
        timestampParameter(progress.completedAt),
        timestampParameter(progress.lastActivityAt),
        progress.evidenceType ?? null,
        progress.evidenceRef ?? null,
        progress.exerciseId,
      ],
    );
    return { changed: result.affectedRows > 0 };
  }
}
