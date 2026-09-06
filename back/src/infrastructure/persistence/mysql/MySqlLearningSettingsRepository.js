import { ConflictError } from "../../../domain/errors.js";

export class MySqlLearningSettingsRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async update(userId, settings, expectedRevision) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [revisionRows] = await connection.execute(
        "SELECT revision FROM user_state_revisions WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      const currentRevision = revisionRows[0] ? Number(revisionRows[0].revision) : null;
      if (currentRevision === null || currentRevision !== expectedRevision) {
        throw new ConflictError(
          "STATE_CONFLICT",
          "Learning state was updated by another session. Reload and try again."
        );
      }

      await connection.execute(
        `INSERT INTO user_settings
           (user_id, daily_new, daily_goal, daily_listening_goal, voice_rate, theme)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           daily_new = VALUES(daily_new),
           daily_goal = VALUES(daily_goal),
           daily_listening_goal = VALUES(daily_listening_goal),
           voice_rate = VALUES(voice_rate),
           theme = VALUES(theme)`,
        [
          userId,
          settings.dailyNew,
          settings.dailyGoal,
          settings.dailyListeningGoal,
          settings.voiceRate,
          settings.theme,
        ]
      );

      const revision = expectedRevision + 1;
      await connection.execute(
        `UPDATE user_state_revisions
         SET revision = ?, updated_at = CURRENT_TIMESTAMP(3)
         WHERE user_id = ?`,
        [revision, userId]
      );
      await connection.commit();
      return revision;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
