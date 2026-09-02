export class MySqlSentencePracticeRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findForHouse(userId, house) {
    const [rows] = await this.pool.execute(
      `SELECT ve.public_id AS word_id,
              ve.primary_form AS term,
              vf.form AS accepted_form,
              uvp.box,
              uvp.mistake_count,
              vs.id AS sentence_id,
              vs.source_item_number,
              vs.variant_number,
              vs.category,
              vs.sentence_text,
              vs.answer_text
       FROM user_vocabulary_progress uvp
       JOIN vocabulary_entries ve
         ON ve.id = uvp.vocabulary_entry_id
        AND ve.status = 'active'
       JOIN vocabulary_forms vf
         ON vf.vocabulary_entry_id = ve.id
       JOIN vocabulary_sentences vs
         ON vs.vocabulary_entry_id = ve.id
        AND vs.status = 'active'
       WHERE uvp.user_id = ?
         AND uvp.status = 'active'
         AND uvp.box = ?
         AND uvp.mastered_at IS NULL
       ORDER BY uvp.mistake_count DESC,
                ve.id,
                vs.source_item_number,
                vs.variant_number,
                vf.is_primary DESC,
                vf.id`,
      [userId, house]
    );

    return rows.map((row) => ({
      wordId: String(row.word_id),
      term: String(row.term),
      acceptedForm: String(row.accepted_form),
      box: Number(row.box),
      mistakes: Number(row.mistake_count),
      sentenceId: String(row.sentence_id),
      sourceItemNumber: Number(row.source_item_number),
      variantNumber: Number(row.variant_number),
      category: String(row.category),
      sentenceText: String(row.sentence_text),
      answerText: String(row.answer_text),
    }));
  }
}
