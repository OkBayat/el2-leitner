function cleanAcceptedForms(acceptedForms) {
  return [...new Set((Array.isArray(acceptedForms) ? acceptedForms : [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean))];
}

function fullTextSearchable(form) {
  if (/[A-Z]/u.test(form)) return false;
  return form
    .split(/[^\p{L}\p{N}]+/u)
    .some((token) => token.length >= 3);
}

function booleanPhrase(form) {
  return `\"${form.replace(/[+\-><()~*\"@]/gu, " ").replace(/\s+/gu, " ").trim()}\"`;
}

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

  async findCandidateSentences(acceptedForms, languageCode = "en", limit = 48) {
    const forms = cleanAcceptedForms(acceptedForms);
    if (!forms.length) return [];
    const candidateLimit = Math.max(6, Math.min(200, Math.trunc(Number(limit) || 48)));
    const byId = new Map();
    const projection = `SELECT id,
              source_item_number,
              variant_number,
              category,
              sentence_text,
              audio_id,
              audio_url,
              audio_contributor,
              audio_license,
              audio_attribution_url
       FROM sentences`;

    const searchable = forms.filter(fullTextSearchable);
    if (searchable.length) {
      const booleanQuery = searchable.map(booleanPhrase).filter((value) => value !== '\"\"').join(" ");
      if (booleanQuery) {
        const [rows] = await this.pool.execute(
          `${projection}
           WHERE status = 'active'
             AND language_code = ?
             AND audio_url IS NOT NULL
             AND MATCH(sentence_text) AGAINST (? IN BOOLEAN MODE)
           ORDER BY id DESC
           LIMIT ${candidateLimit}`,
          [languageCode, booleanQuery]
        );
        for (const row of rows) byId.set(String(row.id), row);
      }
    }

    // MySQL full-text indexes ignore very short tokens and stop words. The
    // bounded LIKE fallback keeps terms such as "is", "May" and "at" usable
    // without ever loading the 800k+ row catalog into application memory.
    if (byId.size < Math.min(12, candidateLimit)) {
      const conditions = forms.map((form) => /[A-Z]/u.test(form)
        ? "BINARY sentence_text LIKE ?"
        : "sentence_text LIKE ?");
      const [rows] = await this.pool.execute(
        `${projection}
         WHERE status = 'active'
           AND language_code = ?
           AND audio_url IS NOT NULL
           AND (${conditions.join(" OR ")})
         ORDER BY id DESC
         LIMIT ${candidateLimit}`,
        [languageCode, ...forms.map((form) => `%${form}%`)]
      );
      for (const row of rows) byId.set(String(row.id), row);
    }

    return [...byId.values()].slice(0, candidateLimit).map((row) => ({
      id: String(row.id),
      sourceItemNumber: row.source_item_number === null ? null : Number(row.source_item_number),
      variantNumber: row.variant_number === null ? null : Number(row.variant_number),
      category: String(row.category ?? "Tatoeba"),
      text: String(row.sentence_text),
      audioId: String(row.audio_id),
      audioUrl: String(row.audio_url),
      audioContributor: row.audio_contributor === null ? null : String(row.audio_contributor),
      audioLicense: row.audio_license === null ? null : String(row.audio_license),
      audioAttributionUrl: row.audio_attribution_url === null ? null : String(row.audio_attribution_url)
    }));
  }
}
