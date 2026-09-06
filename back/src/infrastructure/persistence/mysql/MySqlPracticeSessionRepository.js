import { randomUUID } from "node:crypto";
import { NotFoundError, ValidationError } from "../../../domain/errors.js";

function asDay(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  return null;
}

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

function mapDaily(row) {
  return {
    day: asDay(row.day),
    attempts: Number(row.attempts),
    correct: Number(row.correct_count),
    wrong: Number(row.wrong_count),
    newAdded: Number(row.new_added),
    sessions: Number(row.session_count),
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

  async recordAttempt(userId, sessionId, { day, correct, shadowing = false }) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [sessionRows] = await connection.execute(
        `SELECT * FROM practice_sessions
         WHERE public_id = ? AND user_id = ? AND status = 'active'
         LIMIT 1 FOR UPDATE`,
        [sessionId, userId]
      );
      const session = sessionRows[0];
      if (!session) {
        throw new NotFoundError("PRACTICE_SESSION_NOT_FOUND", "Active practice session was not found.");
      }
      if (!String(session.mode || "").startsWith("sentence-house-") && !(shadowing === true && session.mode === "shadowing-house-1")) {
        throw new ValidationError(
          "INVALID_SESSION",
          "Only sentence-practice or server-graded Box 1 shadowing sessions can record standalone practice attempts."
        );
      }

      const correctIncrement = correct ? 1 : 0;
      const wrongIncrement = correct ? 0 : 1;
      await connection.execute(
        `UPDATE practice_sessions
         SET completed_count = completed_count + 1,
             correct_count = correct_count + ?,
             wrong_count = wrong_count + ?,
             updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        [correctIncrement, wrongIncrement, session.id]
      );
      // Record evidence in the same transaction; opening a session never colors a timeline step.
      await connection.execute(
        `INSERT INTO practice_session_days (practice_session_id, local_day)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE local_day = VALUES(local_day)`,
        [session.id, day]
      );
      await connection.execute(
        `INSERT INTO user_daily_stats
           (user_id, day, attempts, correct_count, wrong_count, new_added, session_count, duration_seconds)
         VALUES (?, ?, 1, ?, ?, 0, 0, 0)
         ON DUPLICATE KEY UPDATE
           attempts = attempts + 1,
           correct_count = correct_count + VALUES(correct_count),
           wrong_count = wrong_count + VALUES(wrong_count)`,
        [userId, day, correctIncrement, wrongIncrement]
      );

      const [updatedSessionRows] = await connection.execute(
        "SELECT * FROM practice_sessions WHERE id = ? LIMIT 1",
        [session.id]
      );
      const [dailyRows] = await connection.execute(
        "SELECT * FROM user_daily_stats WHERE user_id = ? AND day = ? LIMIT 1",
        [userId, day]
      );
      await connection.commit();
      return {
        session: mapSession(updatedSessionRows[0]),
        daily: mapDaily(dailyRows[0])
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
