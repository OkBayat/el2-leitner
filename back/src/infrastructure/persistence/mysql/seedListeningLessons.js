import { createHash } from "node:crypto";

function sourceHash(definition) {
  return createHash("sha256").update(JSON.stringify(definition), "utf8").digest("hex");
}

async function upsertLesson(connection, definition, hash) {
  const [existingRows] = await connection.execute(
    `SELECT id, source_hash, content_version
     FROM listening_lessons
     WHERE public_id = ?
     FOR UPDATE`,
    [definition.publicId]
  );
  const existing = existingRows[0] || null;
  const version = existing
    ? Number(existing.content_version) + (existing.source_hash === hash ? 0 : 1)
    : 1;
  const publishedAt = definition.publishedAt ? new Date(definition.publishedAt) : null;

  if (existing) {
    await connection.execute(
      `UPDATE listening_lessons
       SET provider = ?, slug = ?, title = ?, description = ?, episode_code = ?, episode_date = ?,
           source_url = ?, status = ?, content_version = ?, source_hash = ?, published_at = ?
       WHERE id = ?`,
      [
        definition.provider,
        definition.slug,
        definition.title,
        definition.description,
        definition.episodeCode,
        definition.episodeDate,
        definition.sourceUrl,
        definition.status,
        version,
        hash,
        publishedAt,
        existing.id
      ]
    );
    return { id: Number(existing.id), version, changed: existing.source_hash !== hash };
  }

  const [result] = await connection.execute(
    `INSERT INTO listening_lessons
       (public_id, provider, slug, title, description, episode_code, episode_date, source_url,
        status, content_version, source_hash, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      definition.publicId,
      definition.provider,
      definition.slug,
      definition.title,
      definition.description,
      definition.episodeCode,
      definition.episodeDate,
      definition.sourceUrl,
      definition.status,
      version,
      hash,
      publishedAt
    ]
  );
  return { id: Number(result.insertId), version, changed: true };
}

async function insertQuestion(connection, lessonId, groupId, question) {
  const [questionResult] = await connection.execute(
    `INSERT INTO listening_questions
       (public_id, lesson_id, group_id, question_number, position, response_type, prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [question.id, lessonId, groupId, question.number, question.position, question.responseType, question.prompt]
  );
  const questionId = Number(questionResult.insertId);

  if (question.responseType === "text") {
    for (const answer of question.acceptedAnswers) {
      await connection.execute(
        `INSERT INTO listening_question_answers
           (question_id, accepted_text, normalized_text, option_id, is_primary)
         VALUES (?, ?, ?, NULL, ?)`,
        [questionId, answer.text, answer.normalized, answer.primary]
      );
    }
    return;
  }

  const optionIds = new Map();
  for (const [index, option] of question.options.entries()) {
    const [optionResult] = await connection.execute(
      `INSERT INTO listening_question_options
         (public_id, question_id, label, option_text, position)
       VALUES (?, ?, ?, ?, ?)`,
      [option.id, questionId, option.label, option.text, index + 1]
    );
    optionIds.set(option.id, Number(optionResult.insertId));
  }
  await connection.execute(
    `INSERT INTO listening_question_answers
       (question_id, accepted_text, normalized_text, option_id, is_primary)
     VALUES (?, NULL, NULL, ?, TRUE)`,
    [questionId, optionIds.get(question.correctOptionId)]
  );
}

async function replaceLessonQuestions(connection, lessonId, definition) {
  await connection.execute("DELETE FROM listening_question_groups WHERE lesson_id = ?", [lessonId]);
  for (const group of definition.groups) {
    const [groupResult] = await connection.execute(
      `INSERT INTO listening_question_groups
         (public_id, lesson_id, position, heading, task_type, instruction, answer_instruction, max_words, max_numbers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        group.id,
        lessonId,
        group.position,
        group.heading,
        group.taskType,
        group.instruction,
        group.answerInstruction,
        group.maxWords,
        group.maxNumbers
      ]
    );
    const groupId = Number(groupResult.insertId);
    for (const question of group.questions) {
      await insertQuestion(connection, lessonId, groupId, question);
    }
  }
}

export async function seedListeningLessons({ pool, definitions }) {
  const connection = await pool.getConnection();
  let changed = false;
  let questionCount = 0;
  try {
    await connection.beginTransaction();
    for (const definition of definitions) {
      const lesson = await upsertLesson(connection, definition, sourceHash(definition));
      changed ||= lesson.changed;
      questionCount += definition.questionCount;
      if (lesson.changed) await replaceLessonQuestions(connection, lesson.id, definition);
    }
    await connection.commit();
    return { changed, lessonCount: definitions.length, questionCount };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
