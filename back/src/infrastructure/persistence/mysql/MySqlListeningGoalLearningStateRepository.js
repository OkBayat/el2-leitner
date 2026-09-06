import { MySqlEditableLearningStateRepository } from "./MySqlEditableLearningStateRepository.js";

export const DEFAULT_DAILY_LISTENING_GOAL = 3;
export const MAX_DAILY_LISTENING_GOAL = 12;

export function normalizeDailyListeningGoal(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return DEFAULT_DAILY_LISTENING_GOAL;
  return Math.min(MAX_DAILY_LISTENING_GOAL, Math.max(1, number));
}

export class MySqlListeningGoalLearningStateRepository extends MySqlEditableLearningStateRepository {
  constructor(pool) {
    super(pool);
    this.pool = pool;
  }

  async findByUserId(userId) {
    const result = await super.findByUserId(userId);
    if (!result.state) return result;
    const [rows] = await this.pool.execute(
      "SELECT daily_listening_goal FROM user_settings WHERE user_id = ? LIMIT 1",
      [userId]
    );
    result.state.settings.dailyListeningGoal = normalizeDailyListeningGoal(rows[0]?.daily_listening_goal);
    return result;
  }

  async save(userId, state, expectedRevision, context = {}) {
    const goal = normalizeDailyListeningGoal(state?.settings?.dailyListeningGoal);
    const nextRevision = await super.save(userId, state, expectedRevision, context);
    // Only the state revision produced by this save may write its listening goal.
    // A slower stale request therefore cannot overwrite a newer successful save.
    await this.pool.execute(
      `UPDATE user_settings s
       JOIN user_state_revisions r ON r.user_id = s.user_id
       SET s.daily_listening_goal = ?
       WHERE s.user_id = ? AND r.revision = ?`,
      [goal, userId, nextRevision]
    );
    return nextRevision;
  }
}
