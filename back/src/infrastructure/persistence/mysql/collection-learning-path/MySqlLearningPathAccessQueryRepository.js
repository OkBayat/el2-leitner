import { LearningPathAccessReader } from "../../../../application/collection-learning-path/ports/LearningPathAccessReader.js";

export class MySqlLearningPathAccessQueryRepository extends LearningPathAccessReader {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async getForCollection(userId, collectionPublicId) {
    const [rows] = await this.pool.execute(
      `SELECT c.owner_user_id AS ownerUserId, c.visibility, c.status, c.archived_at AS archivedAt,
              uc.status AS subscriptionStatus
       FROM collections c
       LEFT JOIN user_collections uc
         ON uc.collection_id = c.id AND uc.user_id = ?
       WHERE c.public_id = ?
       LIMIT 1`,
      [userId, collectionPublicId],
    );
    const row = rows[0];
    if (!row) return { canRead: false, canProgress: false };

    const ownsCollection = row.ownerUserId != null && String(row.ownerUserId) === String(userId);
    const publishedForLearners = row.status === "published"
      && row.archivedAt == null
      && (row.visibility === "public" || row.visibility === "unlisted");
    const canRead = ownsCollection || publishedForLearners;
    const canProgress = canRead && (ownsCollection || row.subscriptionStatus === "active");
    return { canRead, canProgress };
  }
}
