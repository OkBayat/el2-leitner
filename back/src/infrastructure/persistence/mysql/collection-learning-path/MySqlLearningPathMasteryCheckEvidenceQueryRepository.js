import { LearningPathMasteryCheckEvidenceReader } from "../../../../application/collection-learning-path/ports/LearningPathMasteryCheckEvidenceReader.js";

function metadataValue(value) {
  if (value == null) return null;
  if (typeof value === "object" && !Buffer.isBuffer(value)) return value;
  try {
    return JSON.parse(Buffer.isBuffer(value) ? value.toString("utf8") : String(value));
  } catch {
    return null;
  }
}

export class MySqlLearningPathMasteryCheckEvidenceQueryRepository extends LearningPathMasteryCheckEvidenceReader {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findCompletedSession(userId, sessionId) {
    const [sessionRows] = await this.pool.execute(
      `SELECT id, public_id, mode, status, planned_count, completed_count, correct_count, wrong_count, metadata_json
       FROM practice_sessions
       WHERE public_id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId],
    );
    const session = sessionRows[0];
    if (!session) return null;

    const [reviewRows] = await this.pool.execute(
      `SELECT ve.public_id AS vocabulary_id
       FROM review_events re
       JOIN vocabulary_entries ve ON ve.id = re.vocabulary_entry_id
       WHERE re.practice_session_id = ? AND re.user_id = ?
       ORDER BY re.id`,
      [session.id, userId],
    );

    return {
      id: session.public_id,
      mode: session.mode,
      status: session.status,
      plannedCount: session.planned_count === null ? null : Number(session.planned_count),
      completedCount: Number(session.completed_count ?? 0),
      correctCount: Number(session.correct_count ?? 0),
      wrongCount: Number(session.wrong_count ?? 0),
      metadata: metadataValue(session.metadata_json),
      reviewedVocabularyIds: reviewRows.map((row) => String(row.vocabulary_id)),
    };
  }
}
