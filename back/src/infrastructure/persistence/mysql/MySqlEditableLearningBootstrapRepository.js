import { MySqlLearningBootstrapRepository } from "./MySqlLearningBootstrapRepository.js";
import { applyVocabularyOverrides } from "./MySqlEditableLearningStateRepository.js";

export class MySqlEditableLearningBootstrapRepository extends MySqlLearningBootstrapRepository {
  constructor(pool, fallbackRepository) {
    super(pool, fallbackRepository);
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
}
