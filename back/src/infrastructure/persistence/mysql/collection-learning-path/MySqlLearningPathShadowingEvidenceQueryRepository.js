export class MySqlLearningPathShadowingEvidenceQueryRepository {
  constructor(pool) { this.pool = pool; }
  async findCompletedSession(userId, sessionId) {
    const [rows] = await this.pool.execute(
      `SELECT mode, status, completed_count, correct_count, wrong_count
       FROM practice_sessions
       WHERE public_id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId],
    );
    const row = rows[0];
    return row ? {
      mode: row.mode,
      status: row.status,
      completedCount: Number(row.completed_count),
      correctCount: Number(row.correct_count),
      wrongCount: Number(row.wrong_count),
    } : null;
  }
}
