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

    return rows.map((row) => ({
      wordId: String(row.word_id),
      term: String(row.term),
      acceptedForm: String(row.accepted_form),
      box: Number(row.box),
      mistakes: Number(row.mistake_count)
    }));
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
