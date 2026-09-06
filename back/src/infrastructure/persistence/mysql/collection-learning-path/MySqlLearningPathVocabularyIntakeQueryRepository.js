import { LearningPathVocabularyIntakeReader } from "../../../../application/collection-learning-path/ports/LearningPathVocabularyIntakeReader.js";
import { NotFoundError } from "../../../../domain/errors.js";

function dayValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timestampValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function collect(rows, key) {
  const values = new Map();
  for (const row of rows) {
    const entryId = String(row.collection_entry_id);
    values.set(entryId, [...(values.get(entryId) ?? []), String(row[key])]);
  }
  return values;
}

export class MySqlLearningPathVocabularyIntakeQueryRepository extends LearningPathVocabularyIntakeReader {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findForScope(userId, scope) {
    if (scope.kind !== "listening-episode") {
      throw new Error(`Unsupported Learning Path vocabulary scope: ${scope.kind}`);
    }
    const [scopeRows] = await this.pool.execute(
      `SELECT l.public_id AS episode_public_id, c.id AS collection_id, c.public_id AS collection_public_id
       FROM listening_lessons l
       JOIN collections c ON c.public_id = l.vocabulary_collection_id
       WHERE l.public_id = ?
         AND l.status = 'published'
         AND c.status = 'published'
         AND c.archived_at IS NULL
       LIMIT 1`,
      [scope.ref],
    );
    const resolved = scopeRows[0];
    if (!resolved) {
      throw new NotFoundError(
        "LEARNING_PATH_VOCABULARY_SCOPE_NOT_FOUND",
        "The configured vocabulary scope was not found.",
      );
    }

    const [entryRows] = await this.pool.execute(
      `SELECT ce.id AS collection_entry_id, ve.public_id AS vocabulary_id,
              COALESCE(ce.display_form, ve.primary_form) AS term,
              uvp.user_id AS progress_user_id, uvp.status AS progress_status,
              uvp.box AS progress_box, uvp.introduced_on AS progress_introduced_on,
              uvp.mastered_at AS progress_mastered_at
       FROM collection_entries ce
       JOIN vocabulary_entries ve
         ON ve.id = ce.vocabulary_entry_id AND ve.status = 'active'
       LEFT JOIN user_vocabulary_progress uvp
         ON uvp.vocabulary_entry_id = ve.id AND uvp.user_id = ?
       WHERE ce.collection_id = ? AND ce.removed_at IS NULL
       ORDER BY ce.position, ce.id`,
      [userId, resolved.collection_id],
    );
    const [definitionRows] = await this.pool.execute(
      `SELECT d.collection_entry_id, d.definition_text
       FROM collection_entry_definitions d
       JOIN collection_entries ce ON ce.id = d.collection_entry_id
       WHERE ce.collection_id = ? AND ce.removed_at IS NULL
       ORDER BY d.position, d.id`,
      [resolved.collection_id],
    );
    const [exampleRows] = await this.pool.execute(
      `SELECT e.collection_entry_id, s.sentence_text
       FROM collection_entry_examples e
       JOIN collection_entries ce ON ce.id = e.collection_entry_id
       JOIN sentences s ON s.id = e.sentence_id
       WHERE ce.collection_id = ? AND ce.removed_at IS NULL
       ORDER BY e.position, e.sentence_id`,
      [resolved.collection_id],
    );
    const definitions = collect(definitionRows, "definition_text");
    const examples = collect(exampleRows, "sentence_text");

    return {
      collectionId: resolved.collection_public_id,
      items: entryRows.map((row) => ({
        vocabularyId: row.vocabulary_id,
        term: row.term,
        definitions: definitions.get(String(row.collection_entry_id)) ?? [],
        examples: examples.get(String(row.collection_entry_id)) ?? [],
        progress: row.progress_user_id == null ? null : {
          status: row.progress_status,
          box: Number(row.progress_box ?? 0),
          introducedOn: dayValue(row.progress_introduced_on),
          masteredAt: timestampValue(row.progress_mastered_at),
        },
      })),
    };
  }
}
