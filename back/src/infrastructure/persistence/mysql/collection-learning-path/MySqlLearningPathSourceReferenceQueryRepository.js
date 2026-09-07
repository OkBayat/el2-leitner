import { LearningPathSourceReferenceReader } from "../../../../application/collection-learning-path/ports/LearningPathSourceReferenceReader.js";

const executor = (pool, options) => options?.connection ?? pool;

export class MySqlLearningPathSourceReferenceQueryRepository extends LearningPathSourceReferenceReader {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findCollectionByPublicId(publicId, options = {}) {
    const db = executor(this.pool, options);
    const [rows] = await db.execute(
      `SELECT c.public_id AS id, c.title
       FROM collections c
       WHERE c.public_id = ?
         AND c.status = 'published'
         AND c.archived_at IS NULL
       LIMIT 1`,
      [publicId],
    );
    if (!rows.length) return null;
    return { id: rows[0].id, title: rows[0].title };
  }

  async findCollectionSection({ collectionId, sectionTitle }, options = {}) {
    const db = executor(this.pool, options);
    const [rows] = await db.execute(
      `SELECT cs.public_id AS id, c.public_id AS collectionId, cs.title
       FROM collection_sections cs
       JOIN collections c ON c.id = cs.collection_id
       WHERE c.public_id = ?
         AND cs.title = ?
         AND c.status = 'published'
         AND c.archived_at IS NULL
       ORDER BY cs.id
       LIMIT 2`,
      [collectionId, sectionTitle],
    );
    if (!rows.length) return null;
    if (rows.length > 1) {
      throw new Error(`Ambiguous collection section reference: ${collectionId} / ${sectionTitle}`);
    }
    return {
      id: rows[0].id,
      collectionId: rows[0].collectionId,
      title: rows[0].title,
    };
  }
}
