export class MySqlVocabularySourceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByVocabularyIds(userId, vocabularyIds) {
    if (!vocabularyIds.length) return [];
    const placeholders = vocabularyIds.map(() => "?").join(", ");
    const [rows] = await this.pool.execute(
      `SELECT ve.public_id AS vocabulary_public_id, ve.primary_form,
              GROUP_CONCAT(DISTINCT CONCAT(c.public_id, '\u001e', c.title) ORDER BY CONCAT(c.public_id, '\u001e', c.title) SEPARATOR '\u001f') AS source_pairs
       FROM user_collections uc
       JOIN collections c ON c.id = uc.collection_id
       JOIN collection_entries ce ON ce.collection_id = c.id AND ce.removed_at IS NULL
       JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id
       LEFT JOIN user_vocabulary_progress uvp
         ON uvp.user_id = uc.user_id AND uvp.vocabulary_entry_id = ve.id
       WHERE uc.user_id = ?
         AND uc.status = 'active'
         AND COALESCE(uvp.status, 'active') <> 'excluded'
         AND ve.public_id IN (${placeholders})
       GROUP BY ve.id
       ORDER BY ve.primary_form`,
      [userId, ...vocabularyIds]
    );
    if (!rows.length) return [];
    const definitions = await this.findDefinitionsByVocabularyIds(
      userId,
      rows.map((row) => String(row.vocabulary_public_id))
    );
    return rows.map((row) => ({
      vocabularyId: row.vocabulary_public_id,
      term: row.primary_form,
      collections: String(row.source_pairs || "").split("\u001f").filter(Boolean).map((pair) => {
        const [id, title] = pair.split("\u001e");
        return { id, title };
      }),
      definitions: definitions.get(String(row.vocabulary_public_id)) ?? []
    }));
  }

  async findDefinitionsByVocabularyIds(userId, vocabularyIds) {
    if (!vocabularyIds.length) return new Map();
    const placeholders = vocabularyIds.map(() => "?").join(", ");
    const [rows] = await this.pool.execute(
      `SELECT ve.public_id AS vocabulary_public_id,
              d.public_id AS definition_id,
              d.language_code,
              d.definition_text,
              c.title AS collection_title
       FROM user_collections uc
       JOIN collections c ON c.id = uc.collection_id
       JOIN collection_entries ce ON ce.collection_id = c.id AND ce.removed_at IS NULL
       JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id
       JOIN collection_entry_definitions d ON d.collection_entry_id = ce.id
       LEFT JOIN user_vocabulary_progress uvp
         ON uvp.user_id = uc.user_id AND uvp.vocabulary_entry_id = ve.id
       WHERE uc.user_id = ?
         AND uc.status = 'active'
         AND COALESCE(uvp.status, 'active') <> 'excluded'
         AND ve.public_id IN (${placeholders})
       ORDER BY ve.id, c.id, d.position, d.id`,
      [userId, ...vocabularyIds]
    );
    const grouped = new Map();
    const seen = new Set();
    for (const row of rows) {
      const vocabularyId = String(row.vocabulary_public_id);
      const id = String(row.definition_id);
      const key = `${vocabularyId}:${id}`;
      const text = String(row.definition_text ?? "").trim();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      if (!grouped.has(vocabularyId)) grouped.set(vocabularyId, []);
      grouped.get(vocabularyId).push({
        id,
        languageCode: String(row.language_code),
        text,
        collectionTitle: String(row.collection_title)
      });
    }
    return grouped;
  }
}
