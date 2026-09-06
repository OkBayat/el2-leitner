import { LearningPathProgressWriter } from "../../../../application/collection-learning-path/ports/LearningPathProgressWriter.js";

const executor = (pool, options) => options?.connection ?? pool;

export class MySqlLearningPathProgressCommandRepository extends LearningPathProgressWriter {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async upsertPathProgress(progress, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `INSERT INTO user_learning_path_progress
        (user_id, learning_path_id, status, started_at, completed_at, last_activity_at, last_seen_content_version)
       SELECT ?, p.id, ?, ?, ?, ?, ?
       FROM collection_learning_paths p
       WHERE p.public_id = ?
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         started_at = LEAST(started_at, VALUES(started_at)),
         completed_at = VALUES(completed_at),
         last_activity_at = GREATEST(last_activity_at, VALUES(last_activity_at)),
         last_seen_content_version = GREATEST(last_seen_content_version, VALUES(last_seen_content_version))`,
      [
        progress.userId,
        progress.status,
        progress.startedAt,
        progress.completedAt ?? null,
        progress.lastActivityAt,
        progress.lastSeenContentVersion ?? 0,
        progress.pathId,
      ],
    );
    return { changed: result.affectedRows > 0 };
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
        progress.startedAt,
        progress.completedAt ?? null,
        progress.lastActivityAt,
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
        progress.startedAt,
        progress.completedAt ?? null,
        progress.lastActivityAt,
        progress.evidenceType ?? null,
        progress.evidenceRef ?? null,
        progress.exerciseId,
      ],
    );
    return { changed: result.affectedRows > 0 };
  }
}
