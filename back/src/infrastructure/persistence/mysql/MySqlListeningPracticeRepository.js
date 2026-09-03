import { randomUUID } from "node:crypto";

import { ConflictError, NotFoundError } from "../../../domain/errors.js";

function isoDateTime(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJson(value, label) {
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed;
}

function mapLessonMetadata(row) {
  return {
    databaseId: Number(row.database_id),
    id: String(row.public_id),
    provider: String(row.provider),
    slug: String(row.slug),
    title: String(row.title),
    description: row.description === null ? null : String(row.description),
    episodeCode: row.episode_code === null ? null : String(row.episode_code),
    episodeDate: row.episode_date === null ? null : String(row.episode_date),
    sourceUrl: String(row.audio_url),
    contentVersion: Number(row.content_version),
    questionCount: Number(row.question_count)
  };
}

function mapAttempt(row) {
  return {
    databaseId: Number(row.database_id),
    id: String(row.public_id),
    userId: String(row.user_id),
    lessonDatabaseId: Number(row.lesson_id),
    lessonContentVersion: Number(row.lesson_content_version),
    status: String(row.status),
    startedAt: isoDateTime(row.started_at),
    submittedAt: isoDateTime(row.submitted_at),
    totalQuestions: Number(row.total_count)
  };
}

function projectQuestion(question, includeAnswers) {
  const base = {
    id: String(question.id),
    number: Number(question.number),
    position: Number(question.position),
    responseType: String(question.responseType),
    prompt: String(question.prompt)
  };
  if (base.responseType === "single_choice") {
    const projected = {
      ...base,
      options: question.options.map((option) => ({
        id: String(option.id),
        label: String(option.label),
        text: String(option.text)
      }))
    };
    if (includeAnswers) projected.correctOptionId = String(question.correctOptionId);
    return projected;
  }
  if (includeAnswers) {
    base.acceptedAnswers = question.acceptedAnswers.map((answer) => ({
      text: String(answer.text),
      normalized: String(answer.normalized),
      primary: Boolean(answer.primary)
    }));
  }
  return base;
}

function projectGroups(content, includeAnswers) {
  if (!Array.isArray(content.groups)) throw new Error("Listening lesson content must contain question groups.");
  return content.groups.map((group) => ({
    id: String(group.id),
    position: Number(group.position),
    heading: String(group.heading),
    taskType: String(group.taskType),
    instruction: String(group.instruction),
    answerInstruction: String(group.answerInstruction),
    maxWords: group.maxWords === null ? null : Number(group.maxWords),
    maxNumbers: group.maxNumbers === null ? null : Number(group.maxNumbers),
    questions: group.questions.map((question) => projectQuestion(question, includeAnswers))
  }));
}

function mapStoredLesson(row, includeAnswers) {
  const metadata = mapLessonMetadata(row);
  const content = parseJson(row.content_json, "Listening lesson content");
  if (Number(content.schemaVersion) !== Number(row.schema_version)) {
    throw new Error(`Listening lesson ${metadata.id} has inconsistent schema versions.`);
  }
  return { ...metadata, groups: projectGroups(content, includeAnswers) };
}

export class MySqlListeningPracticeRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listPublishedLessons(provider) {
    const [rows] = await this.pool.execute(
      `SELECT id AS database_id, public_id, provider, slug, title, description, episode_code,
              DATE_FORMAT(episode_date, '%Y-%m-%d') AS episode_date, audio_url,
              content_version, question_count
       FROM listening_lessons
       WHERE provider = ? AND status = 'published'
       ORDER BY episode_date DESC, id DESC`,
      [provider]
    );
    return rows.map(mapLessonMetadata);
  }

  async findPublishedLessonBySlug(provider, slug, { includeAnswers = false } = {}) {
    const [rows] = await this.pool.execute(
      `SELECT id AS database_id, public_id, provider, slug, title, description, episode_code,
              DATE_FORMAT(episode_date, '%Y-%m-%d') AS episode_date, audio_url,
              schema_version, question_count, content_version, content_json
       FROM listening_lessons
       WHERE provider = ? AND slug = ? AND status = 'published'
       LIMIT 1`,
      [provider, slug]
    );
    if (!rows[0]) {
      throw new NotFoundError("LISTENING_LESSON_NOT_FOUND", "Listening lesson was not found.");
    }
    return mapStoredLesson(rows[0], includeAnswers);
  }

  async startAttempt(userId, lesson) {
    const publicId = randomUUID();
    const startedAt = new Date();
    const [result] = await this.pool.execute(
      `INSERT INTO listening_attempts
         (public_id, user_id, lesson_id, lesson_content_version, status, started_at, total_count)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      [publicId, userId, lesson.databaseId, lesson.contentVersion, startedAt, lesson.questionCount]
    );
    return {
      databaseId: Number(result.insertId),
      id: publicId,
      userId: String(userId),
      lessonDatabaseId: lesson.databaseId,
      lessonContentVersion: lesson.contentVersion,
      status: "active",
      startedAt: startedAt.toISOString(),
      submittedAt: null,
      totalQuestions: lesson.questionCount
    };
  }

  async getAttemptForGrading(userId, attemptId) {
    const [rows] = await this.pool.execute(
      `SELECT a.id AS database_id, a.public_id, a.user_id, a.lesson_id, a.lesson_content_version,
              a.status, a.started_at, a.submitted_at, a.total_count,
              l.id AS lesson_database_id, l.public_id AS lesson_public_id, l.provider, l.slug,
              l.title, l.description, l.episode_code,
              DATE_FORMAT(l.episode_date, '%Y-%m-%d') AS episode_date, l.audio_url,
              l.schema_version, l.question_count, l.content_version, l.content_json
       FROM listening_attempts a
       JOIN listening_lessons l ON l.id = a.lesson_id
       WHERE a.public_id = ? AND a.user_id = ?
       LIMIT 1`,
      [attemptId, userId]
    );
    if (!rows[0]) {
      throw new NotFoundError("LISTENING_ATTEMPT_NOT_FOUND", "Listening attempt was not found.");
    }
    const row = rows[0];
    const attempt = mapAttempt(row);
    if (attempt.status === "completed") {
      return { attempt, lesson: null, completedResult: await this.#readCompletedResult(this.pool, attempt) };
    }
    if (attempt.status !== "active") {
      throw new ConflictError("LISTENING_ATTEMPT_CLOSED", "This listening attempt is no longer active.");
    }
    const lesson = mapStoredLesson({
      database_id: row.lesson_database_id,
      public_id: row.lesson_public_id,
      provider: row.provider,
      slug: row.slug,
      title: row.title,
      description: row.description,
      episode_code: row.episode_code,
      episode_date: row.episode_date,
      audio_url: row.audio_url,
      schema_version: row.schema_version,
      question_count: row.question_count,
      content_version: row.content_version,
      content_json: row.content_json
    }, true);
    return { attempt, lesson, completedResult: null };
  }

  async completeAttempt(userId, attemptId, grade) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT id AS database_id, public_id, user_id, lesson_id, lesson_content_version,
                status, started_at, submitted_at, total_count
         FROM listening_attempts
         WHERE public_id = ? AND user_id = ?
         FOR UPDATE`,
        [attemptId, userId]
      );
      if (!rows[0]) {
        throw new NotFoundError("LISTENING_ATTEMPT_NOT_FOUND", "Listening attempt was not found.");
      }
      const attempt = mapAttempt(rows[0]);
      if (attempt.status === "completed") {
        const result = await this.#readCompletedResult(connection, attempt);
        await connection.commit();
        return result;
      }
      if (attempt.status !== "active") {
        throw new ConflictError("LISTENING_ATTEMPT_CLOSED", "This listening attempt is no longer active.");
      }

      const answersJson = JSON.stringify({
        schemaVersion: 1,
        answers: grade.results.map((result) => ({
          questionId: result.questionId,
          value: result.submittedValue
        }))
      });
      const publicResults = grade.results.map(({ submittedValue: _submittedValue, ...result }) => result);
      const resultJson = JSON.stringify({ schemaVersion: 1, results: publicResults });

      await connection.execute(
        `UPDATE listening_attempts
         SET status = 'completed', submitted_at = CURRENT_TIMESTAMP(3), correct_count = ?,
             wrong_count = ?, percentage = ?, answers_json = ?, result_json = ?
         WHERE id = ?`,
        [
          grade.score.correct,
          grade.score.wrong,
          grade.score.percentage,
          answersJson,
          resultJson,
          attempt.databaseId
        ]
      );
      const result = await this.#readCompletedResult(connection, { ...attempt, status: "completed" });
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async #readCompletedResult(runner, attempt) {
    const [rows] = await runner.execute(
      `SELECT correct_count, wrong_count, total_count, percentage, submitted_at, result_json
       FROM listening_attempts
       WHERE id = ?`,
      [attempt.databaseId]
    );
    if (!rows[0] || rows[0].result_json === null) {
      throw new Error(`Completed listening attempt ${attempt.id} has no result snapshot.`);
    }
    const stored = parseJson(rows[0].result_json, "Listening attempt result");
    if (Number(stored.schemaVersion) !== 1 || !Array.isArray(stored.results)) {
      throw new Error(`Completed listening attempt ${attempt.id} has an invalid result snapshot.`);
    }
    return {
      attempt: {
        id: attempt.id,
        status: "completed",
        startedAt: attempt.startedAt,
        submittedAt: isoDateTime(rows[0].submitted_at),
        totalQuestions: Number(rows[0].total_count)
      },
      score: {
        correct: Number(rows[0].correct_count),
        wrong: Number(rows[0].wrong_count),
        total: Number(rows[0].total_count),
        percentage: Number(rows[0].percentage)
      },
      results: stored.results.map((result) => ({
        questionId: String(result.questionId),
        number: Number(result.number),
        responseType: String(result.responseType),
        correct: Boolean(result.correct),
        submittedAnswer: String(result.submittedAnswer),
        correctAnswer: String(result.correctAnswer)
      }))
    };
  }
}
