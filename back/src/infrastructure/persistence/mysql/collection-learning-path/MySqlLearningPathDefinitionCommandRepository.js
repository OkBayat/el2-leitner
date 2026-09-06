import { LearningPathDefinitionWriter } from "../../../../application/collection-learning-path/ports/LearningPathDefinitionWriter.js";

const executor = (pool, options) => options?.connection ?? pool;

export class MySqlLearningPathDefinitionCommandRepository extends LearningPathDefinitionWriter {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async upsertPath(path, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `INSERT INTO collection_learning_paths
        (public_id, collection_id, title, mode, status, content_version, source_hash, published_at, retired_at)
       SELECT ?, c.id, ?, ?, ?, ?, ?, ?, ?
       FROM collections c
       WHERE c.public_id = ?
       ON DUPLICATE KEY UPDATE
         collection_id = VALUES(collection_id),
         title = VALUES(title),
         mode = VALUES(mode),
         status = VALUES(status),
         content_version = VALUES(content_version),
         source_hash = VALUES(source_hash),
         published_at = VALUES(published_at),
         retired_at = VALUES(retired_at)`,
      [
        path.id,
        path.title,
        path.mode,
        path.status,
        path.contentVersion,
        path.sourceHash ?? null,
        path.publishedAt ?? null,
        path.retiredAt ?? null,
        path.collectionId,
      ],
    );
    return { changed: result.affectedRows > 0 };
  }

  async retirePath(pathPublicId, retirement, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `UPDATE collection_learning_paths
       SET status = 'retired', retired_at = ?
       WHERE public_id = ? AND retired_at IS NULL`,
      [retirement.at, pathPublicId],
    );
    return { changed: result.affectedRows > 0 };
  }

  async upsertLesson(pathPublicId, lesson, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `INSERT INTO learning_path_lessons
        (public_id, learning_path_id, title, position, source_kind, source_ref, status,
         introduced_version, retired_version, published_at, retired_at)
       SELECT ?, p.id, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM collection_learning_paths p
       WHERE p.public_id = ?
       ON DUPLICATE KEY UPDATE
         learning_path_id = VALUES(learning_path_id),
         title = VALUES(title),
         position = VALUES(position),
         source_kind = VALUES(source_kind),
         source_ref = VALUES(source_ref),
         status = VALUES(status),
         introduced_version = VALUES(introduced_version),
         retired_version = VALUES(retired_version),
         published_at = VALUES(published_at),
         retired_at = VALUES(retired_at)`,
      [
        lesson.id,
        lesson.title,
        lesson.position,
        lesson.sourceKind ?? null,
        lesson.sourceRef ?? null,
        lesson.status,
        lesson.introducedVersion,
        lesson.retiredVersion ?? null,
        lesson.publishedAt ?? null,
        lesson.retiredAt ?? null,
        pathPublicId,
      ],
    );
    return { changed: result.affectedRows > 0 };
  }

  async upsertExercise(lessonPublicId, exercise, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `INSERT INTO learning_path_exercises
        (public_id, lesson_id, position, type, schema_version, required, completion_policy,
         config_json, status, introduced_version, retired_version, published_at, retired_at)
       SELECT ?, l.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM learning_path_lessons l
       WHERE l.public_id = ?
       ON DUPLICATE KEY UPDATE
         lesson_id = VALUES(lesson_id),
         position = VALUES(position),
         type = VALUES(type),
         schema_version = VALUES(schema_version),
         required = VALUES(required),
         completion_policy = VALUES(completion_policy),
         config_json = VALUES(config_json),
         status = VALUES(status),
         introduced_version = VALUES(introduced_version),
         retired_version = VALUES(retired_version),
         published_at = VALUES(published_at),
         retired_at = VALUES(retired_at)`,
      [
        exercise.id,
        exercise.position,
        exercise.type,
        exercise.schemaVersion,
        exercise.required,
        exercise.completionPolicy,
        JSON.stringify(exercise.config ?? {}),
        exercise.status,
        exercise.introducedVersion,
        exercise.retiredVersion ?? null,
        exercise.publishedAt ?? null,
        exercise.retiredAt ?? null,
        lessonPublicId,
      ],
    );
    return { changed: result.affectedRows > 0 };
  }

  async retireLesson(lessonPublicId, retirement, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `UPDATE learning_path_lessons
       SET status = 'retired', retired_version = ?, retired_at = ?
       WHERE public_id = ? AND retired_at IS NULL`,
      [retirement.version, retirement.at, lessonPublicId],
    );
    return { changed: result.affectedRows > 0 };
  }

  async retireExercise(exercisePublicId, retirement, options = {}) {
    const db = executor(this.pool, options);
    const [result] = await db.execute(
      `UPDATE learning_path_exercises
       SET status = 'retired', retired_version = ?, retired_at = ?
       WHERE public_id = ? AND retired_at IS NULL`,
      [retirement.version, retirement.at, exercisePublicId],
    );
    return { changed: result.affectedRows > 0 };
  }
}
