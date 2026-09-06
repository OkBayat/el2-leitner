import { LearningPathDefinitionReader } from "../../../../application/collection-learning-path/ports/LearningPathDefinitionReader.js";

const executor = (pool, options) => options?.connection ?? pool;

const parseConfig = (value) => {
  if (value == null) return {};
  if (typeof value === "string") return JSON.parse(value);
  return value;
};

const pathFromRow = (row) => ({
  id: row.id,
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

  async findByPublicId(publicId, { includeRetired = false, connection = null } = {}) {
    return this.#findPath(
      `p.public_id = ?${includeRetired ? "" : " AND p.retired_at IS NULL"}`,
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
      `SELECT p.public_id AS id, c.public_id AS collectionId, p.title, p.mode, p.status,
              p.content_version AS contentVersion, p.source_hash AS sourceHash,
              p.published_at AS publishedAt, p.retired_at AS retiredAt
       FROM collection_learning_paths p
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
      `SELECT l.public_id AS id, l.title, l.position, l.source_kind AS sourceKind,
              l.source_ref AS sourceRef, l.status, l.introduced_version AS introducedVersion,
              l.retired_version AS retiredVersion, l.published_at AS publishedAt,
              l.retired_at AS retiredAt
       FROM learning_path_lessons l
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
      `SELECT l.public_id AS lessonId, e.public_id AS id, e.position, e.type,
              e.schema_version AS schemaVersion, e.required, e.completion_policy AS completionPolicy,
              e.config_json AS configJson, e.status, e.introduced_version AS introducedVersion,
              e.retired_version AS retiredVersion, e.published_at AS publishedAt,
              e.retired_at AS retiredAt
       FROM learning_path_exercises e
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
