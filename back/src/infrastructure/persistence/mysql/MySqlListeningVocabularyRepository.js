import { NotFoundError } from "../../../domain/errors.js";

export class MySqlListeningVocabularyRepository {
  constructor(pool) { this.pool = pool; }

  async findForEpisode(userId, provider, slug) {
    const [episodes] = await this.pool.execute(
      `SELECT l.public_id, l.slug, l.title, l.level, c.id AS collection_id, c.public_id AS collection_public_id,
              uc.status AS subscription_status
       FROM listening_lessons l
       JOIN collections c ON c.public_id = l.vocabulary_collection_id
       LEFT JOIN user_collections uc ON uc.collection_id = c.id AND uc.user_id = ?
       WHERE l.provider = ? AND l.slug = ? AND l.status = 'published'
         AND c.visibility = 'public' AND c.status = 'published' AND c.archived_at IS NULL LIMIT 1`,
      [userId, provider, slug]
    );
    const episode = episodes[0];
    if (!episode) throw new NotFoundError("LISTENING_VOCABULARY_NOT_FOUND", "Episode vocabulary was not found.");
    const [entries] = await this.pool.execute(
      `SELECT ce.id, ce.public_id, ve.public_id AS vocabulary_id, COALESCE(ce.display_form, ve.primary_form) AS term,
              uvp.box, uvp.introduced_on, uvp.mastered_at, uvp.status AS progress_status
       FROM collection_entries ce
       JOIN vocabulary_entries ve ON ve.id = ce.vocabulary_entry_id AND ve.status = 'active'
       LEFT JOIN user_vocabulary_progress uvp ON uvp.vocabulary_entry_id = ve.id AND uvp.user_id = ?
       WHERE ce.collection_id = ? AND ce.removed_at IS NULL ORDER BY ce.position, ce.id`,
      [userId, episode.collection_id]
    );
    // Three bounded, collection-scoped queries avoid N+1 reads and cross-episode example leakage.
    const [definitions] = await this.pool.execute(
      `SELECT d.collection_entry_id, d.definition_text
       FROM collection_entry_definitions d JOIN collection_entries ce ON ce.id = d.collection_entry_id
       WHERE ce.collection_id = ? AND ce.removed_at IS NULL ORDER BY d.position, d.id`,
      [episode.collection_id]
    );
    const [examples] = await this.pool.execute(
      `SELECT e.collection_entry_id, s.sentence_text
       FROM collection_entry_examples e JOIN collection_entries ce ON ce.id = e.collection_entry_id
       JOIN sentences s ON s.id = e.sentence_id
       WHERE ce.collection_id = ? AND ce.removed_at IS NULL ORDER BY e.position, e.sentence_id`,
      [episode.collection_id]
    );
    const collect = (rows, key) => {
      const map = new Map();
      for (const row of rows) {
        const id = String(row.collection_entry_id);
        map.set(id, [...(map.get(id) || []), String(row[key])]);
      }
      return map;
    };
    const definitionsByEntry = collect(definitions, "definition_text");
    const examplesByEntry = collect(examples, "sentence_text");
    return {
      episode: { id: episode.public_id, slug: episode.slug, title: episode.title, level: episode.level },
      collectionId: episode.collection_public_id,
      subscribed: episode.subscription_status === "active",
      entries: entries.map((entry) => ({
        id: entry.public_id,
        vocabularyId: entry.vocabulary_id,
        term: entry.term,
        definitions: definitionsByEntry.get(String(entry.id)) || [],
        examples: examplesByEntry.get(String(entry.id)) || [],
        progress: {
          state: entry.progress_status === "excluded" ? "excluded" : entry.mastered_at ? "mastered"
            : Number(entry.box) > 0 || entry.introduced_on ? "learning" : "new",
          box: Number(entry.box || 0)
        }
      }))
    };
  }
}
