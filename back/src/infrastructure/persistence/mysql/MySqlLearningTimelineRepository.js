// This read model intentionally returns evidence only, never answer snapshots or vocabulary payloads.
export class MySqlLearningTimelineRepository {
  constructor(pool) { this.pool = pool; }

  async read(userId, { from, to, today = to }) {
    // A padded UTC window contains every IANA local day, including historical DST changes.
    const fromSeconds = Date.parse(`${from}T00:00:00Z`) / 1000 - 86_400;
    const toSeconds = Date.parse(`${to}T00:00:00Z`) / 1000 + 172_800;
    const [reviews, practice, listening, legacy, bounds, vocabularyToday, settings] = await Promise.all([
      this.pool.execute(
        `SELECT DISTINCT DATE_FORMAT(local_day, '%Y-%m-%d') AS day,
                CASE WHEN mode = 'box1' THEN 'box1' ELSE 'vocabulary' END AS activity
         FROM review_events
         WHERE user_id = ? AND local_day BETWEEN ? AND ?`,
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
           WHERE user_id = ?) AS reviewDay,
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
      this.pool.execute(
        `SELECT
          (SELECT COUNT(DISTINCT re.vocabulary_entry_id)
           FROM review_events re
           JOIN vocabulary_entries ve ON ve.id = re.vocabulary_entry_id AND ve.status = 'active'
           JOIN collection_entries ce ON ce.vocabulary_entry_id = ve.id AND ce.removed_at IS NULL
           JOIN user_collections uc ON uc.collection_id = ce.collection_id
             AND uc.user_id = re.user_id AND uc.status = 'active'
           JOIN collections c ON c.id = ce.collection_id AND c.archived_at IS NULL
           WHERE re.user_id = ? AND re.local_day = ?
             AND COALESCE(re.mode, 'review') <> 'box1') AS completed,
          (SELECT COUNT(DISTINCT uvp.vocabulary_entry_id)
           FROM user_vocabulary_progress uvp
           JOIN vocabulary_entries ve ON ve.id = uvp.vocabulary_entry_id AND ve.status = 'active'
           JOIN collection_entries ce ON ce.vocabulary_entry_id = ve.id AND ce.removed_at IS NULL
           JOIN user_collections uc ON uc.collection_id = ce.collection_id
             AND uc.user_id = uvp.user_id AND uc.status = 'active'
           JOIN collections c ON c.id = ce.collection_id AND c.archived_at IS NULL
           WHERE uvp.user_id = ?
             AND COALESCE(uvp.status, 'active') <> 'excluded'
             AND uvp.box > 0 AND uvp.mastered_at IS NULL
             AND uvp.due_date IS NOT NULL AND uvp.due_date <= ?
             AND (uvp.blocked_until IS NULL OR uvp.blocked_until <= ?)
             AND NOT EXISTS (
               SELECT 1 FROM review_events re
               WHERE re.user_id = uvp.user_id
                 AND re.vocabulary_entry_id = uvp.vocabulary_entry_id
                 AND re.local_day = ?
                 AND COALESCE(re.mode, 'review') <> 'box1'
             )) AS remaining`,
        [userId, today, userId, today, today, today]
      ),
      this.pool.execute(
        "SELECT daily_listening_goal AS dailyListeningGoal FROM user_settings WHERE user_id = ? LIMIT 1",
        [userId]
      ),
    ]);
    return {
      reviews: reviews[0],
      practice: practice[0],
      listening: listening[0],
      legacy: legacy[0],
      first: bounds[0][0] ?? {},
      vocabularyToday: vocabularyToday[0][0] ?? { completed: 0, remaining: 0 },
      settings: settings[0][0] ?? { dailyListeningGoal: 3 },
    };
  }
}
