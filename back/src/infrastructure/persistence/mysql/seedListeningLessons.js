import { createHash } from "node:crypto";

function sourceHash(definition) {
  return createHash("sha256").update(JSON.stringify(definition), "utf8").digest("hex");
}

function storedContent(definition) {
  return {
    schemaVersion: definition.schemaVersion,
    tests: definition.tests
  };
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
  if (existing && existing.source_hash === hash) {
    return { id: Number(existing.id), version: Number(existing.content_version), changed: false };
  }

  const version = existing ? Number(existing.content_version) + 1 : 1;
  const publishedAt = definition.publishedAt ? new Date(definition.publishedAt) : null;
  const contentJson = JSON.stringify(storedContent(definition));

  if (existing) {
    await connection.execute(
      `UPDATE listening_lessons
       SET provider = ?, slug = ?, title = ?, description = ?, episode_code = ?, episode_date = ?,
           source_url = ?, status = ?, schema_version = ?, question_count = ?, content_version = ?,
           source_hash = ?, content_json = ?, published_at = ?
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
        definition.schemaVersion,
        definition.questionCount,
        version,
        hash,
        contentJson,
        publishedAt,
        existing.id
      ]
    );
    return { id: Number(existing.id), version, changed: true };
  }

  const [result] = await connection.execute(
    `INSERT INTO listening_lessons
       (public_id, provider, slug, title, description, episode_code, episode_date, source_url,
        status, schema_version, question_count, content_version, source_hash, content_json, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      definition.schemaVersion,
      definition.questionCount,
      version,
      hash,
      contentJson,
      publishedAt
    ]
  );
  return { id: Number(result.insertId), version, changed: true };
}

export async function seedListeningLessons({ pool, definitions }) {
  const connection = await pool.getConnection();
  let changed = false;
  let questionCount = 0;
  let testCount = 0;
  try {
    await connection.beginTransaction();
    for (const definition of definitions) {
      const lesson = await upsertLesson(connection, definition, sourceHash(definition));
      changed ||= lesson.changed;
      questionCount += definition.questionCount;
      testCount += definition.testCount;
    }
    await connection.commit();
    return { changed, lessonCount: definitions.length, testCount, questionCount };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
