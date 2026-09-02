import { ConflictError, NotFoundError } from "../../../domain/errors.js";
import { MySqlEfficientLearningStateRepository } from "./MySqlEfficientLearningStateRepository.js";

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

export function applyVocabularyOverrides(state, rows) {
  if (!state || !Array.isArray(state.words) || !Array.isArray(rows) || !rows.length) return state;
  const byId = new Map(rows.map((row) => [String(row.public_id), row]));
  for (const word of state.words) {
    const override = byId.get(String(word.id));
    if (!override) continue;
    const accepted = parseJson(override.accepted_forms_json, []);
    word.term = String(override.primary_form || word.term);
    word.accepted = Array.isArray(accepted) && accepted.length
      ? accepted.map((value) => String(value))
      : [word.term];
  }
  return state;
}

export function restoreCanonicalVocabularyForms(state, rows) {
  if (!state || !Array.isArray(state.words) || !Array.isArray(rows) || !rows.length) return state;
  const byId = new Map(rows.map((row) => [String(row.public_id), row]));
  for (const word of state.words) {
    const canonical = byId.get(String(word.id));
    if (!canonical) continue;
    const accepted = String(canonical.accepted_forms || "")
      .split("\u001f")
      .map((value) => value.trim())
      .filter(Boolean);
    word.term = String(canonical.primary_form || word.term);
    word.accepted = accepted.length ? accepted : [word.term];
  }
  return state;
}

export class MySqlEditableLearningStateRepository extends MySqlEfficientLearningStateRepository {
  constructor(pool) {
    super(pool);
    this.pool = pool;
  }

  async findByUserId(userId) {
    const result = await super.findByUserId(userId);
    if (!result.state) return result;
    const [rows] = await this.pool.execute(
      `SELECT ve.public_id, uvo.primary_form, uvo.accepted_forms_json
       FROM user_vocabulary_overrides uvo
       JOIN vocabulary_entries ve ON ve.id = uvo.vocabulary_entry_id
       WHERE uvo.user_id = ? AND ve.status = 'active'`,
      [userId]
    );
    applyVocabularyOverrides(result.state, rows);
    return result;
  }

  async save(userId, state, expectedRevision, context = {}) {
    const [rows] = await this.pool.execute(
      `SELECT ve.public_id, ve.primary_form,
              GROUP_CONCAT(vf.form ORDER BY vf.is_primary DESC, vf.id SEPARATOR '\u001f') AS accepted_forms
       FROM user_vocabulary_overrides uvo
       JOIN vocabulary_entries ve ON ve.id = uvo.vocabulary_entry_id
       LEFT JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
       WHERE uvo.user_id = ? AND ve.status = 'active'
       GROUP BY ve.id`,
      [userId]
    );
    const canonicalState = restoreCanonicalVocabularyForms(structuredClone(state), rows);
    return super.save(userId, canonicalState, expectedRevision, context);
  }

  async updateVocabulary(userId, word, expectedRevision) {
    await this.#ensureNormalizedState(userId);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [revisionRows] = await connection.execute(
        "SELECT revision FROM user_state_revisions WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      const currentRevision = revisionRows[0] ? Number(revisionRows[0].revision) : 0;
      if (currentRevision !== expectedRevision) {
        throw new ConflictError(
          "STATE_CONFLICT",
          "Learning state was updated by another session. Reload and try again."
        );
      }

      const [vocabularyRows] = await connection.execute(
        `SELECT ve.id, ve.public_id
         FROM vocabulary_entries ve
         JOIN collection_entries ce
           ON ce.vocabulary_entry_id = ve.id AND ce.removed_at IS NULL
         JOIN user_collections uc
           ON uc.collection_id = ce.collection_id AND uc.user_id = ? AND uc.status = 'active'
         WHERE ve.public_id = ? AND ve.status = 'active'
         LIMIT 1`,
        [userId, word.id]
      );
      const vocabulary = vocabularyRows[0];
      if (!vocabulary) {
        throw new NotFoundError("VOCABULARY_NOT_FOUND", "Vocabulary was not found for this learner.");
      }

      await connection.execute(
        `INSERT INTO user_vocabulary_overrides
           (user_id, vocabulary_entry_id, primary_form, accepted_forms_json)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           primary_form = VALUES(primary_form),
           accepted_forms_json = VALUES(accepted_forms_json),
           updated_at = CURRENT_TIMESTAMP(3)`,
        [userId, vocabulary.id, word.term, JSON.stringify(word.accepted)]
      );

      await connection.execute(
        `INSERT INTO user_vocabulary_progress
           (user_id, vocabulary_entry_id, status, personal_note, legacy_category)
         VALUES (?, ?, 'active', ?, ?)
         ON DUPLICATE KEY UPDATE
           personal_note = VALUES(personal_note),
           legacy_category = VALUES(legacy_category),
           updated_at = CURRENT_TIMESTAMP(3)`,
        [userId, vocabulary.id, word.notes || null, word.category || null]
      );

      const nextRevision = expectedRevision + 1;
      await connection.execute(
        `UPDATE user_state_revisions
         SET revision = ?, updated_at = CURRENT_TIMESTAMP(3)
         WHERE user_id = ?`,
        [nextRevision, userId]
      );
      await connection.commit();
      return nextRevision;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async #ensureNormalizedState(userId) {
    const [rows] = await this.pool.execute(
      "SELECT revision FROM user_state_revisions WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!rows[0]) await super.findByUserId(userId);
  }
}
