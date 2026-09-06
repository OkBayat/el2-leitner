// This read model intentionally returns evidence only, never answer snapshots or vocabulary payloads.
export class MySqlLearningTimelineRepository {
  constructor(pool) { this.pool = pool; }

  async read(userId, { from, to }) {
    // A padded UTC window contains every IANA local day, including historical DST changes.
    const fromSeconds = Date.parse(`${from}T00:00:00Z`) / 1000 - 86_400;
    const toSeconds = Date.parse(`${to}T00:00:00Z`) / 1000 + 172_800;
    const [reviews, practice, listening, legacy, bounds] = await Promise.all([
      this.pool.execute(
        `SELECT DISTINCT DATE_FORMAT(local_day, '%Y-%m-%d') AS day,
                CASE WHEN mode = 'box1' THEN 'box1' ELSE 'vocabulary' END AS activity
         FROM review_events
         WHERE user_id = ? AND local_day BETWEEN ? AND ?
           AND (mode IN ('review', 'new', 'box1') OR mode IS NULL)`,
        [userId, from, to]
      ),
      this.pool.execute(
        `SELECT DISTINCT DATE_FORMAT(d.local_day, '%Y-%m-%d') AS day,
                CASE WHEN s.mode = 'shadowing-house-1' THEN 'shadowing' ELSE 'box1' END AS activity
         FROM practice_session_days d
         JOIN practice_sessions s ON s.id = d.practice_session_id
         WHERE s.user_id = ? AND d.local_day BETWEEN ? AND ?
           AND s.mode IN ('sentence-house-1', 'shadowing-house-1')`,
        [userId, from, to]
      ),
      this.pool.execute(
        `SELECT UNIX_TIMESTAMP(submitted_at) * 1000 AS at
         FROM listening_attempts
         WHERE user_id = ? AND status = 'completed'
           AND submitted_at >= FROM_UNIXTIME(?) AND submitted_at < FROM_UNIXTIME(?)`,
        [userId, fromSeconds, toSeconds]
      ),
      this.pool.execute(
        `SELECT UNIX_TIMESTAMP(s.started_at) * 1000 AS startedAt,
                UNIX_TIMESTAMP(COALESCE(s.completed_at, s.updated_at)) * 1000 AS lastAt,
                CASE WHEN s.mode = 'shadowing-house-1' THEN 'shadowing' ELSE 'box1' END AS activity
         FROM practice_sessions s
         WHERE s.user_id = ? AND s.completed_count > 0
           AND s.mode IN ('sentence-house-1', 'shadowing-house-1')
           AND s.started_at < FROM_UNIXTIME(?)
           AND COALESCE(s.completed_at, s.updated_at) >= FROM_UNIXTIME(?)
           AND NOT EXISTS (SELECT 1 FROM practice_session_days d WHERE d.practice_session_id = s.id)`,
        [userId, toSeconds, fromSeconds]
      ),
      this.pool.execute(
        `SELECT
          (SELECT DATE_FORMAT(MIN(local_day), '%Y-%m-%d') FROM review_events
           WHERE user_id = ? AND (mode IN ('review', 'new', 'box1') OR mode IS NULL)) AS reviewDay,
          (SELECT DATE_FORMAT(MIN(d.local_day), '%Y-%m-%d') FROM practice_session_days d
           JOIN practice_sessions s ON s.id = d.practice_session_id
           WHERE s.user_id = ? AND s.mode IN ('sentence-house-1', 'shadowing-house-1')) AS practiceDay,
          (SELECT UNIX_TIMESTAMP(MIN(submitted_at)) * 1000 FROM listening_attempts
           WHERE user_id = ? AND status = 'completed') AS listeningAt,
          (SELECT UNIX_TIMESTAMP(MIN(s.started_at)) * 1000 FROM practice_sessions s
           WHERE s.user_id = ? AND s.completed_count > 0
             AND s.mode IN ('sentence-house-1', 'shadowing-house-1')
             AND NOT EXISTS (SELECT 1 FROM practice_session_days d WHERE d.practice_session_id = s.id)) AS legacyAt`,
        [userId, userId, userId, userId]
      ),
    ]);
    return { reviews: reviews[0], practice: practice[0], listening: listening[0], legacy: legacy[0], first: bounds[0][0] ?? {} };
  }
}
