export class MySqlSentencePracticeRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findWordsForHouse(userId, house) {
    const [rows] = await this.pool.execute(
      `SELECT ve.public_id AS word_id,
              ve.primary_form AS term,
              vf.form AS accepted_form,
              uvp.box,
              uvp.mistake_count
       FROM user_vocabulary_progress uvp
       JOIN vocabulary_entries ve
         ON ve.id = uvp.vocabulary_entry_id
        AND ve.status = 'active'
       JOIN vocabulary_forms vf
         ON vf.vocabulary_entry_id = ve.id
       WHERE uvp.user_id = ?
         AND uvp.status = 'active'
         AND uvp.box = ?
         AND uvp.mastered_at IS NULL
       ORDER BY uvp.mistake_count DESC,
                ve.id,
                vf.is_primary DESC,
                vf.id`,
      [userId, house]
    );
    if (!rows.length) return [];
    const definitions = await this.findDefinitionsForHouse(userId, house);
    return rows.map((row) => ({
      definitions: definitions.get(String(row.word_id)) ?? [],
      wordId: String(row.word_id),
      term: String(row.term),
      acceptedForm: String(row.accepted_form),
      box: Number(row.box),
      mistakes: Number(row.mistake_count)
    }));
  }

  async findDefinitionsForHouse(userId, house) {
    // One bounded read for the house, not one request per card or accepted form.
    const [rows] = await this.pool.execute(
      `SELECT ve.public_id AS word_id,
              d.public_id AS definition_id,
              d.language_code,
              d.definition_text,
              c.title AS collection_title
       FROM user_vocabulary_progress uvp
       JOIN vocabulary_entries ve
         ON ve.id = uvp.vocabulary_entry_id AND ve.status = 'active'
       JOIN collection_entries ce
         ON ce.vocabulary_entry_id = ve.id AND ce.removed_at IS NULL
       JOIN user_collections uc
         ON uc.collection_id = ce.collection_id
        AND uc.user_id = uvp.user_id AND uc.status = 'active'
       JOIN collections c ON c.id = ce.collection_id
       JOIN collection_entry_definitions d ON d.collection_entry_id = ce.id
       WHERE uvp.user_id = ? AND uvp.box = ?
         AND uvp.status = 'active' AND uvp.mastered_at IS NULL
         AND c.archived_at IS NULL
         AND ((c.visibility = 'public' AND c.status = 'published') OR c.owner_user_id = ?)
       ORDER BY ve.id, c.id, d.position, d.id`,
      [userId, house, userId]
    );
    const grouped = new Map();
    const seen = new Set();
    for (const row of rows) {
      const wordId = String(row.word_id);
      const id = String(row.definition_id);
      const key = `${wordId}:${id}`;
      const text = String(row.definition_text ?? "").trim();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      if (!grouped.has(wordId)) grouped.set(wordId, []);
      grouped.get(wordId).push({
        id,
        text,
        languageCode: String(row.language_code),
        collectionTitle: String(row.collection_title)
      });
    }
    return grouped;
  }

  async findActiveSentences() {
    const [rows] = await this.pool.execute(
      `SELECT id, sentence_text
       FROM sentences
       WHERE status = 'active'
       ORDER BY id`
    );
    return rows.map((row) => ({
      id: String(row.id),
      sourceItemNumber: null,
      variantNumber: null,
      category: "General",
      text: String(row.sentence_text)
    }));
  }
}
