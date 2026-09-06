import { LearningPathCourseCatalogWriter } from "../../../../application/collection-learning-path/ports/LearningPathCourseCatalogWriter.js";
import { ConflictError } from "../../../../domain/errors.js";

const executor = (pool, options) => options?.connection ?? pool;

export class MySqlLearningPathCourseCatalogCommandRepository extends LearningPathCourseCatalogWriter {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async ensureCourse(course, options = {}) {
    const db = executor(this.pool, options);
    const [rows] = await db.execute(
      `SELECT public_id AS id, slug, owner_user_id AS ownerUserId
       FROM collections
       WHERE public_id = ? OR slug = ?
       FOR UPDATE`,
      [course.id, course.slug],
    );

    if (rows.length > 1 || (rows[0] && (rows[0].id !== course.id || rows[0].slug !== course.slug))) {
      throw new ConflictError(
        "LEARNING_PATH_COURSE_IDENTITY_CONFLICT",
        `Collection identity ${course.id}/${course.slug} is already owned by another collection.`,
      );
    }
    if (rows[0]?.ownerUserId != null) {
      throw new ConflictError(
        "LEARNING_PATH_COURSE_OWNERSHIP_CONFLICT",
        `Managed course ${course.id} cannot replace a learner-owned collection.`,
      );
    }

    const metadataJson = JSON.stringify(course.metadata ?? {});
    if (!rows.length) {
      const [result] = await db.execute(
        `INSERT INTO collections
          (public_id, slug, title, description, kind, visibility, status, owner_user_id,
           content_version, metadata_json, source_hash, is_default, published_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, NULL, FALSE, CURRENT_TIMESTAMP(3), NULL)`,
        [
          course.id,
          course.slug,
          course.title,
          course.description ?? null,
          course.kind,
          course.visibility,
          course.status,
          metadataJson,
        ],
      );
      return { changed: result.affectedRows > 0 };
    }

    const [result] = await db.execute(
      `UPDATE collections
       SET title = ?, description = ?, kind = ?, visibility = ?, status = ?,
           metadata_json = ?, is_default = FALSE, archived_at = NULL,
           published_at = COALESCE(published_at, CURRENT_TIMESTAMP(3))
       WHERE public_id = ?`,
      [
        course.title,
        course.description ?? null,
        course.kind,
        course.visibility,
        course.status,
        metadataJson,
        course.id,
      ],
    );
    return { changed: result.affectedRows > 0 };
  }
}
