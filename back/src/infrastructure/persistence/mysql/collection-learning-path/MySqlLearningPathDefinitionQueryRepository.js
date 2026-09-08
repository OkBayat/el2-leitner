import { LearningPathDefinitionReader } from "../../../../application/collection-learning-path/ports/LearningPathDefinitionReader.js";

const executor = (pool, options) => options?.connection ?? pool;

const parseConfig = (value) => {
  if (value == null) return {};
  if (typeof value === "string") return JSON.parse(value);
  return value;
};

const pathFromRow = (row) => ({
  id: row.id,
  publicId: row.publicId == null ? null : String(row.publicId),
  collectionId: row.collectionId,
  title: row.title,
  mode: row.mode,
  status: row.status,
  contentVersion: Number(row.contentVersion),
  sourceHash: row.sourceHash ?? null,
  publishedAt: row.publishedAt ?? null,
  retiredAt: row.retiredAt ?? null,
});

const lessonFromRow = (row) => ({
  id: row.id,
  publicId: row.publicId == null ? null : String(row.publicId),
  title: row.title,
  position: Number(row.position),
  sourceKind: row.sourceKind ?? null,
  sourceRef: row.sourceRef ?? null,
  status: row.status,
  introducedVersion: Number(row.introducedVersion),
  retiredVersion: row.retiredVersion == null ? null : Number(row.retiredVersion),
  publishedAt: row.publishedAt ?? null,
  retiredAt: row.retiredAt ?? null,
  exercises: [],
});

const exerciseFromRow = (row) => ({
  id: row.id,
  publicId: row.publicId == null ? null : String(row.publicId),
  position: Number(row.position),
  type: row.type,
  schemaVersion: Number(row.schemaVersion),
  required: Boolean(row.required),
  completionPolicy: row.completionPolicy,
  config: parseConfig(row.configJson),
  status: row.status,
  introducedVersion: Number(row.introducedVersion),
  retiredVersion: row.retiredVersion == null ? null : Number(row.retiredVersion),
  publishedAt: row.publishedAt ?? null,
  retiredAt: row.retiredAt ?? null,
});

export class MySqlLearningPathDefinitionQueryRepository extends LearningPathDefinitionReader {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async listActiveCollectionRoutes({ connection = null } = {}) {
    const db = executor(this.pool, { connection });
    const [rows] = await db.execute(
      `SELECT c.public_id AS collectionId, pr.public_id AS pathId
       FROM collection_learning_paths p
       JOIN learning_path_route_ids pr ON pr.learning_path_id = p.id
       JOIN collections c ON c.id = p.collection_id
       WHERE p.status = 'published' AND p.retired_at IS NULL
       ORDER BY c.public_id`,
    );
    return rows.map((row) => ({ collectionId: row.collectionId, pathId: String(row.pathId) }));
  }

  async findByPublicId(publicId, { includeRetired = false, connection = null } = {}) {
    return this.#findPath(
      `p.public_id = ?${includeRetired ? "" : " AND p.retired_at IS NULL"}`,
      [publicId],
      { includeRetired, connection },
    );
  }

  async findByRoutePublicId(publicId, { includeRetired = false, connection = null } = {}) {
    return this.#findPath(
      `pr.public_id = ?${includeRetired ? "" : " AND p.retired_at IS NULL"}`,
      [publicId],
      { includeRetired, connection },
    );
  }

  async findActiveByCollectionPublicId(collectionPublicId, { connection = null } = {}) {
    return this.#findPath(
      "c.public_id = ? AND p.retired_at IS NULL AND p.status <> 'retired'",
      [collectionPublicId],
      { includeRetired: false, connection },
    );
  }

  async #findPath(predicate, parameters, { includeRetired, connection }) {
    const db = executor(this.pool, { connection });
    const [paths] = await db.execute(
      `SELECT p.public_id AS id, pr.public_id AS publicId, c.public_id AS collectionId, p.title, p.mode, p.status,
              p.content_version AS contentVersion, p.source_hash AS sourceHash,
              p.published_at AS publishedAt, p.retired_at AS retiredAt
       FROM collection_learning_paths p
       JOIN learning_path_route_ids pr ON pr.learning_path_id = p.id
       JOIN collections c ON c.id = p.collection_id
       WHERE ${predicate}
       ORDER BY p.id DESC
       LIMIT 1`,
      parameters,
    );
    if (!paths.length) return null;

    const path = pathFromRow(paths[0]);
    const retiredClause = includeRetired ? "" : " AND l.retired_at IS NULL";
    const [lessonRows] = await db.execute(
      `SELECT l.public_id AS id, lr.public_id AS publicId, l.title, l.position, l.source_kind AS sourceKind,
              l.source_ref AS sourceRef, l.status, l.introduced_version AS introducedVersion,
              l.retired_version AS retiredVersion, l.published_at AS publishedAt,
              l.retired_at AS retiredAt
       FROM learning_path_lessons l
       JOIN learning_path_lesson_route_ids lr ON lr.lesson_id = l.id
       JOIN collection_learning_paths p ON p.id = l.learning_path_id
       WHERE p.public_id = ?${retiredClause}
       ORDER BY l.position, l.id`,
      [path.id],
    );
    path.lessons = lessonRows.map(lessonFromRow);
    if (!path.lessons.length) return path;

    const lessonIds = path.lessons.map((lesson) => lesson.id);
    const placeholders = lessonIds.map(() => "?").join(", ");
    const exerciseRetiredClause = includeRetired ? "" : " AND e.retired_at IS NULL";
    const [exerciseRows] = await db.execute(
      `SELECT l.public_id AS lessonId, e.public_id AS id, er.public_id AS publicId, e.position, e.type,
              e.schema_version AS schemaVersion, e.required, e.completion_policy AS completionPolicy,
              e.config_json AS configJson, e.status, e.introduced_version AS introducedVersion,
              e.retired_version AS retiredVersion, e.published_at AS publishedAt,
              e.retired_at AS retiredAt
       FROM learning_path_exercises e
       JOIN learning_path_exercise_route_ids er ON er.exercise_id = e.id
       JOIN learning_path_lessons l ON l.id = e.lesson_id
       WHERE l.public_id IN (${placeholders})${exerciseRetiredClause}
       ORDER BY l.position, e.position, e.id`,
      lessonIds,
    );
    const lessonsById = new Map(path.lessons.map((lesson) => [lesson.id, lesson]));
    for (const row of exerciseRows) {
      lessonsById.get(row.lessonId)?.exercises.push(exerciseFromRow(row));
    }
    return path;
  }
}
