import { randomUUID } from "node:crypto";

import { ConflictError, NotFoundError } from "../../../domain/errors.js";

function isoDateTime(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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
    contentVersion: Number(row.content_version),
    questionCount: Number(row.question_count ?? 0)
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

function publicResultRow(row) {
  return {
    questionId: String(row.question_public_id),
    number: Number(row.question_number),
    responseType: String(row.response_type),
    correct: Boolean(row.correct),
    submittedAnswer: String(row.submitted_answer),
    correctAnswer: String(row.correct_answer)
  };
}

export class MySqlListeningPracticeRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listPublishedLessons(provider) {
    const [rows] = await this.pool.execute(
      `SELECT l.id AS database_id, l.public_id, l.provider, l.slug, l.title, l.description,
              l.episode_code, DATE_FORMAT(l.episode_date, '%Y-%m-%d') AS episode_date,
              l.source_url, l.content_version, COUNT(q.id) AS question_count
       FROM listening_lessons l
       LEFT JOIN listening_questions q ON q.lesson_id = l.id
       WHERE l.provider = ? AND l.status = 'published'
       GROUP BY l.id
       ORDER BY l.episode_date DESC, l.id DESC`,
      [provider]
    );
    return rows.map(mapLessonMetadata);
  }

  async findPublishedLessonBySlug(provider, slug, { includeAnswers = false } = {}) {
    const [rows] = await this.pool.execute(
      `SELECT l.id AS database_id, l.public_id, l.provider, l.slug, l.title, l.description,
              l.episode_code, DATE_FORMAT(l.episode_date, '%Y-%m-%d') AS episode_date,
              l.source_url, l.content_version,
              (SELECT COUNT(*) FROM listening_questions q WHERE q.lesson_id = l.id) AS question_count
       FROM listening_lessons l
       WHERE l.provider = ? AND l.slug = ? AND l.status = 'published'
       LIMIT 1`,
      [provider, slug]
    );
    if (!rows[0]) {
      throw new NotFoundError("LISTENING_LESSON_NOT_FOUND", "Listening lesson was not found.");
    }
    return this.#loadLesson(mapLessonMetadata(rows[0]), includeAnswers, this.pool);
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
              DATE_FORMAT(l.episode_date, '%Y-%m-%d') AS episode_date,
              l.source_url, l.content_version,
              (SELECT COUNT(*) FROM listening_questions q WHERE q.lesson_id = l.id) AS question_count
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
    const lesson = await this.#loadLesson({
      databaseId: Number(row.lesson_database_id),
      id: String(row.lesson_public_id),
      provider: String(row.provider),
      slug: String(row.slug),
      title: String(row.title),
      description: row.description === null ? null : String(row.description),
      episodeCode: row.episode_code === null ? null : String(row.episode_code),
      episodeDate: row.episode_date === null ? null : String(row.episode_date),
      sourceUrl: String(row.source_url),
      contentVersion: Number(row.content_version),
      questionCount: Number(row.question_count)
    }, true, this.pool);
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

      const placeholders = grade.results.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",");
      const values = grade.results.flatMap((result) => [
        attempt.databaseId,
        result.questionId,
        result.number,
        result.responseType,
        result.submittedValue || null,
        result.submittedAnswer,
        result.correctAnswer,
        result.correct
      ]);
      await connection.execute(
        `INSERT INTO listening_attempt_answers
           (attempt_id, question_public_id, question_number, response_type, submitted_value,
            submitted_answer, correct_answer, correct)
         VALUES ${placeholders}`,
        values
      );
      await connection.execute(
        `UPDATE listening_attempts
         SET status = 'completed', submitted_at = CURRENT_TIMESTAMP(3), correct_count = ?,
             wrong_count = ?, percentage = ?
         WHERE id = ?`,
        [grade.score.correct, grade.score.wrong, grade.score.percentage, attempt.databaseId]
      );
      const [completedRows] = await connection.execute(
        `SELECT id AS database_id, public_id, user_id, lesson_id, lesson_content_version,
                status, started_at, submitted_at, total_count
         FROM listening_attempts WHERE id = ?`,
        [attempt.databaseId]
      );
      const completedAttempt = mapAttempt(completedRows[0]);
      await connection.commit();
      return {
        attempt: {
          id: completedAttempt.id,
          status: completedAttempt.status,
          startedAt: completedAttempt.startedAt,
          submittedAt: completedAttempt.submittedAt,
          totalQuestions: completedAttempt.totalQuestions
        },
        score: grade.score,
        results: grade.results.map(({ submittedValue: _submittedValue, ...result }) => result)
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async #loadLesson(metadata, includeAnswers, runner) {
    const [groupRows] = await runner.execute(
      `SELECT id AS database_id, public_id, position, heading, task_type, instruction,
              answer_instruction, max_words, max_numbers
       FROM listening_question_groups
       WHERE lesson_id = ?
       ORDER BY position`,
      [metadata.databaseId]
    );
    const [questionRows] = await runner.execute(
      `SELECT id AS database_id, public_id, group_id, question_number, position, response_type, prompt
       FROM listening_questions
       WHERE lesson_id = ?
       ORDER BY question_number`,
      [metadata.databaseId]
    );
    const [optionRows] = await runner.execute(
      `SELECT o.id AS database_id, o.public_id, o.question_id, o.label, o.option_text, o.position
       FROM listening_question_options o
       JOIN listening_questions q ON q.id = o.question_id
       WHERE q.lesson_id = ?
       ORDER BY q.question_number, o.position`,
      [metadata.databaseId]
    );
    const answerRows = includeAnswers
      ? (await runner.execute(
        `SELECT a.question_id, a.accepted_text, a.normalized_text, a.option_id, a.is_primary,
                o.public_id AS option_public_id
         FROM listening_question_answers a
         JOIN listening_questions q ON q.id = a.question_id
         LEFT JOIN listening_question_options o ON o.id = a.option_id
         WHERE q.lesson_id = ?
         ORDER BY a.question_id, a.is_primary DESC, a.id`,
        [metadata.databaseId]
      ))[0]
      : [];

    const groups = groupRows.map((row) => ({
      databaseId: Number(row.database_id),
      id: String(row.public_id),
      position: Number(row.position),
      heading: String(row.heading),
      taskType: String(row.task_type),
      instruction: String(row.instruction),
      answerInstruction: String(row.answer_instruction),
      maxWords: row.max_words === null ? null : Number(row.max_words),
      maxNumbers: row.max_numbers === null ? null : Number(row.max_numbers),
      questions: []
    }));
    const groupsByDatabaseId = new Map(groups.map((group) => [group.databaseId, group]));
    const optionsByQuestionId = new Map();
    for (const row of optionRows) {
      const questionId = Number(row.question_id);
      const options = optionsByQuestionId.get(questionId) || [];
      options.push({
        databaseId: Number(row.database_id),
        id: String(row.public_id),
        label: String(row.label),
        text: String(row.option_text),
        position: Number(row.position)
      });
      optionsByQuestionId.set(questionId, options);
    }
    const answersByQuestionId = new Map();
    for (const row of answerRows) {
      const questionId = Number(row.question_id);
      const answers = answersByQuestionId.get(questionId) || [];
      answers.push(row);
      answersByQuestionId.set(questionId, answers);
    }

    for (const row of questionRows) {
      const databaseId = Number(row.database_id);
      const question = {
        databaseId,
        id: String(row.public_id),
        number: Number(row.question_number),
        position: Number(row.position),
        responseType: String(row.response_type),
        prompt: String(row.prompt)
      };
      if (question.responseType === "single_choice") {
        question.options = (optionsByQuestionId.get(databaseId) || []).map(({ databaseId: _id, position: _position, ...option }) => option);
        if (includeAnswers) {
          question.correctOptionId = answersByQuestionId.get(databaseId)?.find((answer) => answer.option_public_id)?.option_public_id || null;
        }
      } else if (includeAnswers) {
        question.acceptedAnswers = (answersByQuestionId.get(databaseId) || []).map((answer) => ({
          text: String(answer.accepted_text),
          normalized: String(answer.normalized_text),
          primary: Boolean(answer.is_primary)
        }));
      }
      const group = groupsByDatabaseId.get(Number(row.group_id));
      if (!group) throw new Error(`Listening question ${question.id} references an unknown group.`);
      group.questions.push(question);
    }

    return {
      ...metadata,
      groups: groups.map(({ databaseId: _databaseId, ...group }) => group)
    };
  }

  async #readCompletedResult(runner, attempt) {
    const [scoreRows] = await runner.execute(
      `SELECT correct_count, wrong_count, total_count, percentage, submitted_at
       FROM listening_attempts
       WHERE id = ?`,
      [attempt.databaseId]
    );
    const [answerRows] = await runner.execute(
      `SELECT question_public_id, question_number, response_type, submitted_answer, correct_answer, correct
       FROM listening_attempt_answers
       WHERE attempt_id = ?
       ORDER BY question_number`,
      [attempt.databaseId]
    );
    const score = scoreRows[0];
    return {
      attempt: {
        id: attempt.id,
        status: "completed",
        startedAt: attempt.startedAt,
        submittedAt: isoDateTime(score.submitted_at),
        totalQuestions: Number(score.total_count)
      },
      score: {
        correct: Number(score.correct_count),
        wrong: Number(score.wrong_count),
        total: Number(score.total_count),
        percentage: Number(score.percentage)
      },
      results: answerRows.map(publicResultRow)
    };
  }
}
