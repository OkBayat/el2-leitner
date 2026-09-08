import { LearningPathCatalogReader } from "../../../../application/collection-learning-path/ports/LearningPathCatalogReader.js";

export class MySqlLearningPathCatalogQueryRepository extends LearningPathCatalogReader {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async listAvailableForUser(userId) {
    const [rows] = await this.pool.execute(
      `SELECT c.public_id AS collectionId, pr.public_id AS pathId, p.title,
              COALESCE(up.status, 'available') AS learnerStatus,
              up.user_id IS NOT NULL AS enrolled
       FROM collection_learning_paths p
       JOIN learning_path_route_ids pr ON pr.learning_path_id = p.id
       JOIN collections c ON c.id = p.collection_id
       LEFT JOIN user_learning_path_progress up
         ON up.learning_path_id = p.id AND up.user_id = ?
       WHERE p.status = 'published' AND p.retired_at IS NULL
         AND (
           c.owner_user_id = ?
           OR (
             c.status = 'published'
             AND c.archived_at IS NULL
             AND c.visibility IN ('public', 'unlisted')
           )
         )
       ORDER BY p.title, p.id`,
      [userId, userId],
    );
    return rows.map((row) => ({
      collectionId: row.collectionId,
      pathId: String(row.pathId),
      title: row.title,
      learnerStatus: row.learnerStatus,
      enrolled: Boolean(row.enrolled),
    }));
  }
}
