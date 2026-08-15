import { ConflictError, NotFoundError } from "../../../domain/errors.js";
import { reviewEventKey } from "./MySqlLearningStateRepository.js";

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export class MySqlReviewProgressRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async record(userId, { expectedRevision, word, event, daily, practiceSessionId = null }) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [revisionRows] = await connection.execute(
        "SELECT revision FROM user_state_revisions WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      const revisionRow = revisionRows[0];
      if (!revisionRow) {
        throw new NotFoundError("LEARNING_STATE_NOT_FOUND", "Learning state was not found.");
      }

      const currentRevision = Number(revisionRow.revision);
      const eventKey = reviewEventKey(userId, event);
      const [existingEventRows] = await connection.execute(
        "SELECT id FROM review_events WHERE event_key = ? AND user_id = ? LIMIT 1",
        [eventKey, userId]
      );
      if (existingEventRows[0]) {
        if (currentRevision === expectedRevision + 1) {
          await connection.commit();
          return currentRevision;
        }
        throw new ConflictError(
          "STATE_CONFLICT",
          "Learning state was updated by another session. Reload and try again."
        );
      }

      if (currentRevision !== expectedRevision) {
        throw new ConflictError(
          "STATE_CONFLICT",
          "Learning state was updated by another session. Reload and try again."
        );
      }

      const [targetRows] = await connection.execute(
        `SELECT ve.id AS vocabulary_entry_id, ce.collection_id
         FROM vocabulary_entries ve
         JOIN collection_entries ce
           ON ce.vocabulary_entry_id = ve.id AND ce.removed_at IS NULL
         JOIN user_collections uc
           ON uc.collection_id = ce.collection_id AND uc.user_id = ? AND uc.status = 'active'
         JOIN collections c ON c.id = ce.collection_id AND c.archived_at IS NULL
         WHERE ve.public_id = ? AND ve.status = 'active'
         ORDER BY c.is_default DESC, ce.collection_id
         LIMIT 1`,
        [userId, word.id]
      );
      const target = targetRows[0];
      if (!target) {
        throw new NotFoundError("VOCABULARY_NOT_FOUND", "Vocabulary entry was not found in an active collection.");
      }

      await connection.execute(
        `INSERT INTO user_vocabulary_progress
           (user_id, vocabulary_entry_id, status, box, due_date, attempts, correct_count, mistake_count,
            current_streak, introduced_on, introduced_via, last_reviewed_at, last_promoted_on,
            blocked_until, mastered_at)
         VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = 'active', box = VALUES(box), due_date = VALUES(due_date), attempts = VALUES(attempts),
           correct_count = VALUES(correct_count), mistake_count = VALUES(mistake_count),
           current_streak = VALUES(current_streak), introduced_on = VALUES(introduced_on),
           introduced_via = VALUES(introduced_via), last_reviewed_at = VALUES(last_reviewed_at),
           last_promoted_on = VALUES(last_promoted_on), blocked_until = VALUES(blocked_until),
           mastered_at = VALUES(mastered_at)`,
        [
          userId,
          target.vocabulary_entry_id,
          word.box,
          word.due,
          word.attempts,
          word.correct,
          word.mistakes,
          word.currentStreak,
          word.introducedOn,
          word.addedSource,
          asDate(word.lastReviewed),
          word.lastPromotedDay,
          word.blockedUntil,
          asDate(word.masteredAt)
        ]
      );

      await connection.execute(
        `INSERT INTO user_daily_stats
           (user_id, day, attempts, correct_count, wrong_count, new_added, session_count, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           attempts = VALUES(attempts), correct_count = VALUES(correct_count), wrong_count = VALUES(wrong_count),
           new_added = VALUES(new_added), session_count = VALUES(session_count),
           duration_seconds = VALUES(duration_seconds)`,
        [
          userId,
          event.day,
          daily.attempts,
          daily.correct,
          daily.wrong,
          daily.newAdded,
          daily.sessions,
          daily.durationSeconds
        ]
      );

      let practiceSessionDbId = null;
      if (practiceSessionId) {
        const [sessionRows] = await connection.execute(
          "SELECT id FROM practice_sessions WHERE public_id = ? AND user_id = ? LIMIT 1",
          [practiceSessionId, userId]
        );
        practiceSessionDbId = sessionRows[0]?.id ?? null;
      }

      await connection.execute(
        `INSERT INTO review_events
           (event_key, user_id, vocabulary_entry_id, collection_id, practice_session_id,
            occurred_at, local_day, answer, correct, mode, previous_box, new_box,
            promoted, mistake_number, term_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventKey,
          userId,
          target.vocabulary_entry_id,
          target.collection_id,
          practiceSessionDbId,
          asDate(event.at),
          event.day,
          event.answer || null,
          event.correct,
          event.mode || null,
          event.previousBox,
          event.newBox,
          event.promoted,
          event.mistakeNumber,
          event.term
        ]
      );

      const nextRevision = currentRevision + 1;
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
}
