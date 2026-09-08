import { LearningPathVocabularySpellingReader } from "../../../../application/collection-learning-path/ports/LearningPathVocabularySpellingReader.js";
import { NotFoundError } from "../../../../domain/errors.js";

function acceptedForms(value, term) {
  return [...new Set([term, ...String(value ?? "").split("\u001f")].map((item) => item.trim()).filter(Boolean))];
}

export class MySqlLearningPathVocabularySpellingQueryRepository extends LearningPathVocabularySpellingReader {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findForCourseAndLearner(userId, collectionId) {
    const [collectionRows] = await this.pool.execute(
      `SELECT id FROM collections
       WHERE public_id = ? AND status = 'published' AND archived_at IS NULL
       LIMIT 1`,
      [collectionId],
    );
    const collection = collectionRows[0];
    if (!collection) {
      throw new NotFoundError("LEARNING_PATH_VOCABULARY_SCOPE_NOT_FOUND", "The configured vocabulary collection was not found.");
    }

    const [rows] = await this.pool.execute(
      `SELECT ve.public_id AS vocabulary_id, ve.primary_form AS term,
              GROUP_CONCAT(DISTINCT vf.form ORDER BY vf.form SEPARATOR '\u001f') AS accepted_forms,
              MAX(CASE WHEN course_entry.id IS NULL THEN 0 ELSE 1 END) AS course_member,
              uvp.status AS progress_status, uvp.box AS progress_box,
              uvp.mastered_at AS progress_mastered_at
       FROM user_vocabulary_progress uvp
       JOIN vocabulary_entries ve ON ve.id = uvp.vocabulary_entry_id AND ve.status = 'active'
       LEFT JOIN vocabulary_forms vf ON vf.vocabulary_entry_id = ve.id
       LEFT JOIN collection_entries course_entry
         ON course_entry.vocabulary_entry_id = ve.id
        AND course_entry.collection_id = ?
        AND course_entry.removed_at IS NULL
       WHERE uvp.user_id = ?
         AND uvp.status = 'active'
         AND uvp.box = 1
         AND uvp.mastered_at IS NULL
       GROUP BY ve.id, ve.public_id, ve.primary_form, uvp.status, uvp.box, uvp.mastered_at
       ORDER BY ve.public_id`,
      [collection.id, userId],
    );

    return {
      items: rows.map((row) => ({
        vocabularyId: String(row.vocabulary_id),
        term: String(row.term),
        accepted: acceptedForms(row.accepted_forms, String(row.term)),
        courseMember: Boolean(row.course_member),
        progress: {
          status: String(row.progress_status),
          box: Number(row.progress_box),
          masteredAt: row.progress_mastered_at ?? null,
        },
      })),
    };
  }
}
