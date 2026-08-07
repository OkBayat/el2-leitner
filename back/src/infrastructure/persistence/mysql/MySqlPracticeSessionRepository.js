import { randomUUID } from "node:crypto";
import { NotFoundError } from "../../../domain/errors.js";

function mapSession(row) {
  return {
    id: row.public_id,
    mode: row.mode,
    status: row.status,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at,
    completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
    plannedCount: row.planned_count === null ? null : Number(row.planned_count),
    completedCount: Number(row.completed_count),
    correctCount: Number(row.correct_count),
    wrongCount: Number(row.wrong_count),
    durationSeconds: Number(row.duration_seconds)
  };
}

export class MySqlPracticeSessionRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async start(userId, { mode, plannedCount }) {
    const publicId = randomUUID();
    const [result] = await this.pool.execute(
      `INSERT INTO practice_sessions (public_id, user_id, mode, started_at, planned_count)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP(3), ?)`,
      [publicId, userId, mode, plannedCount]
    );
    const [rows] = await this.pool.execute("SELECT * FROM practice_sessions WHERE id = ?", [result.insertId]);
    return mapSession(rows[0]);
  }

  async complete(userId, sessionId, values) {
    const [result] = await this.pool.execute(
      `UPDATE practice_sessions
       SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP(3)), status = 'completed', completed_count = ?,
           correct_count = ?, wrong_count = ?, duration_seconds = ?
       WHERE public_id = ? AND user_id = ? AND status = 'active'`,
      [
        values.completedCount,
        values.correctCount,
        values.wrongCount,
        values.durationSeconds,
        sessionId,
        userId
      ]
    );
    if (result.affectedRows !== 1) {
      const [rows] = await this.pool.execute(
        "SELECT * FROM practice_sessions WHERE public_id = ? AND user_id = ? LIMIT 1",
        [sessionId, userId]
      );
      if (!rows[0]) throw new NotFoundError("PRACTICE_SESSION_NOT_FOUND", "Practice session was not found.");
      return mapSession(rows[0]);
    }
    const [rows] = await this.pool.execute(
      "SELECT * FROM practice_sessions WHERE public_id = ? AND user_id = ? LIMIT 1",
      [sessionId, userId]
    );
    return mapSession(rows[0]);
  }
  async abandon(userId, sessionId, { durationSeconds }) {
    const [result] = await this.pool.execute(
      `UPDATE practice_sessions
       SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP(3)), status = 'abandoned', duration_seconds = ?
       WHERE public_id = ? AND user_id = ? AND status = 'active'`,
      [durationSeconds, sessionId, userId]
    );
    if (result.affectedRows !== 1) {
      const [rows] = await this.pool.execute(
        "SELECT * FROM practice_sessions WHERE public_id = ? AND user_id = ? LIMIT 1",
        [sessionId, userId]
      );
      if (!rows[0]) throw new NotFoundError("PRACTICE_SESSION_NOT_FOUND", "Practice session was not found.");
      return mapSession(rows[0]);
    }
    const [rows] = await this.pool.execute(
      "SELECT * FROM practice_sessions WHERE public_id = ? AND user_id = ? LIMIT 1",
      [sessionId, userId]
    );
    return mapSession(rows[0]);
  }

}
