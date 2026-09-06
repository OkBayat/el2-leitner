import { LearningPathProgressReader } from "../../../../application/collection-learning-path/ports/LearningPathProgressReader.js";

const mapPathProgress = (row) => row ? ({
  status: row.status,
  startedAt: row.startedAt,
  completedAt: row.completedAt ?? null,
  lastActivityAt: row.lastActivityAt,
  lastSeenContentVersion: Number(row.lastSeenContentVersion),
}) : null;

const mapLessonProgress = (row) => ({
  lessonId: row.lessonId,
  status: row.status,
  startedAt: row.startedAt,
  completedAt: row.completedAt ?? null,
  lastActivityAt: row.lastActivityAt,
});

const mapExerciseProgress = (row) => ({
  exerciseId: row.exerciseId,
  status: row.status,
  startedAt: row.startedAt,
  completedAt: row.completedAt ?? null,
  lastActivityAt: row.lastActivityAt,
  evidenceType: row.evidenceType ?? null,
  evidenceRef: row.evidenceRef ?? null,
});

export class MySqlLearningPathProgressQueryRepository extends LearningPathProgressReader {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findForPath(userId, pathPublicId) {
    const [pathRows] = await this.pool.execute(
      `SELECT up.status, up.started_at AS startedAt, up.completed_at AS completedAt,
              up.last_activity_at AS lastActivityAt,
              up.last_seen_content_version AS lastSeenContentVersion
       FROM user_learning_path_progress up
       JOIN collection_learning_paths p ON p.id = up.learning_path_id
       WHERE up.user_id = ? AND p.public_id = ?
       LIMIT 1`,
      [userId, pathPublicId],
    );

    const [lessonRows] = await this.pool.execute(
      `SELECT l.public_id AS lessonId, ul.status, ul.started_at AS startedAt,
              ul.completed_at AS completedAt, ul.last_activity_at AS lastActivityAt
       FROM user_learning_path_lesson_progress ul
       JOIN learning_path_lessons l ON l.id = ul.lesson_id
       JOIN collection_learning_paths p ON p.id = l.learning_path_id
       WHERE ul.user_id = ? AND p.public_id = ?
       ORDER BY l.position, l.id`,
      [userId, pathPublicId],
    );

    const [exerciseRows] = await this.pool.execute(
      `SELECT e.public_id AS exerciseId, ue.status, ue.started_at AS startedAt,
              ue.completed_at AS completedAt, ue.last_activity_at AS lastActivityAt,
              ue.evidence_type AS evidenceType, ue.evidence_ref AS evidenceRef
       FROM user_learning_path_exercise_progress ue
       JOIN learning_path_exercises e ON e.id = ue.exercise_id
       JOIN learning_path_lessons l ON l.id = e.lesson_id
       JOIN collection_learning_paths p ON p.id = l.learning_path_id
       WHERE ue.user_id = ? AND p.public_id = ?
       ORDER BY l.position, e.position, e.id`,
      [userId, pathPublicId],
    );

    return {
      path: mapPathProgress(pathRows[0]),
      lessons: lessonRows.map(mapLessonProgress),
      exercises: exerciseRows.map(mapExerciseProgress),
    };
  }
}
