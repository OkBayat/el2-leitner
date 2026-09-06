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
    sourceUrl: String(row.source_url),
    audioFile: row.audio_file === null || row.audio_file === undefined ? null : String(row.audio_file),
    level: row.level || "intermediate",
    imageFile: row.image_file || null,
    assetDirectory: row.asset_directory || null,
    vocabularyCollectionId: row.vocabulary_collection_id || null,
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
    testId: String(row.test_id),
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

function projectGroups(groups, includeAnswers) {
  if (!Array.isArray(groups)) throw new Error("Listening test must contain question groups.");
  return groups.map((group) => ({
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

function projectTests(content, includeAnswers) {
  if (!Array.isArray(content.tests)) throw new Error("Listening lesson content must contain tests.");
  return content.tests.map((test) => ({
    id: String(test.id),
    title: String(test.title),
    position: Number(test.position),
    format: test.format || "ielts",
    difficulty: test.difficulty || "medium",
    questionCount: Number(test.questionCount),
    groups: projectGroups(test.groups, includeAnswers)
  }));
}

function parseStoredContent(row, metadata) {
  const content = parseJson(row.content_json, "Listening lesson content");
  if (Number(content.schemaVersion) !== Number(row.schema_version)) {
    throw new Error(`Listening lesson ${metadata.id} has inconsistent schema versions.`);
  }
  return content;
}

function mapStoredLesson(row, includeAnswers) {
  const metadata = mapLessonMetadata(row);
  const content = parseStoredContent(row, metadata);
  const tests = projectTests(content, includeAnswers);
  return { ...metadata, testCount: tests.length, tests };
}

function mapCatalogLesson(row, completions) {
  const metadata = mapLessonMetadata(row);
  const content = parseStoredContent(row, metadata);
  const tests = projectTests(content, false).map(({ groups: _groups, ...test }) => {
    const completedAt = completions.get(`${metadata.databaseId}:${test.id}`) || null;
    return { ...test, completed: Boolean(completedAt), completedAt };
  });
  return { ...metadata, testCount: tests.length, tests };
}

export class MySqlListeningPracticeRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listPublishedLessons(provider, userId) {
    const [rows, completionRows] = await Promise.all([
      this.pool.execute(
        `SELECT id AS database_id, public_id, provider, slug, title, description, episode_code,
                DATE_FORMAT(episode_date, '%Y-%m-%d') AS episode_date, source_url, audio_file,
                level, image_file, asset_directory, vocabulary_collection_id,
                schema_version, content_version, question_count, content_json
         FROM listening_lessons
         WHERE provider = ? AND status = 'published'
         ORDER BY episode_date DESC, id DESC`,
        [provider]
      ),
      this.pool.execute(
        `SELECT a.lesson_id, a.test_id, MAX(a.submitted_at) AS completed_at
         FROM listening_attempts a
         JOIN listening_lessons l ON l.id = a.lesson_id
         WHERE a.user_id = ? AND a.status = 'completed'
           AND l.provider = ? AND l.status = 'published'
         GROUP BY a.lesson_id, a.test_id`,
        [userId, provider]
      )
    ]);
    const completions = new Map(completionRows[0].map((row) => [
      `${Number(row.lesson_id)}:${String(row.test_id)}`,
      isoDateTime(row.completed_at)
    ]));
    return rows[0].map((row) => mapCatalogLesson(row, completions));
  }

  async findPublishedAudioBySlug(provider, slug) {
    const [rows] = await this.pool.execute(
      `SELECT public_id, audio_file, asset_directory
       FROM listening_lessons
       WHERE provider = ? AND slug = ? AND status = 'published'
       LIMIT 1`,
      [provider, slug]
    );
    if (!rows[0] || !rows[0].audio_file) {
      throw new NotFoundError("LISTENING_AUDIO_NOT_FOUND", "Listening episode audio was not found.");
    }
    return { audioFile: String(rows[0].audio_file), ...(rows[0].asset_directory ? { assetDirectory: String(rows[0].asset_directory), legacyAudioFile: `${rows[0].public_id}.mp3` } : {}) };
  }

  async findPublishedImageBySlug(provider, slug) {
    const [rows] = await this.pool.execute(
      "SELECT image_file, asset_directory FROM listening_lessons WHERE provider = ? AND slug = ? AND status = 'published' LIMIT 1",
      [provider, slug]
    );
    if (!rows[0]?.image_file || !rows[0]?.asset_directory) {
      throw new NotFoundError("LISTENING_IMAGE_NOT_FOUND", "Listening episode image was not found.");
    }
    return { imageFile: rows[0].image_file, assetDirectory: rows[0].asset_directory };
  }

  async findPublishedLessonBySlug(provider, slug, { includeAnswers = false } = {}) {
    const [rows] = await this.pool.execute(
      `SELECT id AS database_id, public_id, provider, slug, title, description, episode_code,
              DATE_FORMAT(episode_date, '%Y-%m-%d') AS episode_date, source_url, audio_file,
                level, image_file, asset_directory, vocabulary_collection_id,
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

  async startAttempt(userId, lesson, test) {
    const publicId = randomUUID();
    const startedAt = new Date();
    const [result] = await this.pool.execute(
      `INSERT INTO listening_attempts
         (public_id, user_id, lesson_id, test_id, lesson_content_version, status, started_at, total_count)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      [publicId, userId, lesson.databaseId, test.id, lesson.contentVersion, startedAt, test.questionCount]
    );
    return {
      databaseId: Number(result.insertId),
      id: publicId,
      userId: String(userId),
      lessonDatabaseId: lesson.databaseId,
      testId: test.id,
      lessonContentVersion: lesson.contentVersion,
      status: "active",
      startedAt: startedAt.toISOString(),
      submittedAt: null,
      totalQuestions: test.questionCount
    };
  }

  async getAttemptForGrading(userId, attemptId) {
    const [rows] = await this.pool.execute(
      `SELECT a.id AS database_id, a.public_id, a.user_id, a.lesson_id, a.test_id, a.lesson_content_version,
              a.status, a.started_at, a.submitted_at, a.total_count,
              l.id AS lesson_database_id, l.public_id AS lesson_public_id, l.provider, l.slug,
              l.title, l.description, l.episode_code,
              DATE_FORMAT(l.episode_date, '%Y-%m-%d') AS episode_date, l.source_url, l.audio_file,
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
      return { attempt, lesson: null, test: null, completedResult: await this.#readCompletedResult(this.pool, attempt) };
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
      source_url: row.source_url,
      audio_file: row.audio_file,
      schema_version: row.schema_version,
      question_count: row.question_count,
      content_version: row.content_version,
      content_json: row.content_json
    }, true);
    const test = lesson.tests.find((candidate) => candidate.id === attempt.testId) || null;
    return { attempt, lesson, test, completedResult: null };
  }

  async findCompletedAttempt(userId, attemptId) {
    const [rows] = await this.pool.execute(
      `SELECT a.public_id, a.user_id, a.test_id, a.status, a.submitted_at,
              l.provider, l.slug AS lesson_slug
       FROM listening_attempts a
       JOIN listening_lessons l ON l.id = a.lesson_id
       WHERE a.public_id = ? AND a.user_id = ? AND a.status = 'completed'
       LIMIT 1`,
      [attemptId, userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.public_id),
      userId: String(row.user_id),
      provider: String(row.provider),
      lessonSlug: String(row.lesson_slug),
      testId: String(row.test_id),
      status: String(row.status),
      submittedAt: isoDateTime(row.submitted_at),
    };
  }

  async completeAttempt(userId, attemptId, grade) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT id AS database_id, public_id, user_id, lesson_id, test_id, lesson_content_version,
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
        testId: attempt.testId,
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
