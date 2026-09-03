import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { parseListeningLessonDefinition } from "../src/domain/listening-practice/ListeningLessonDefinition.js";
import { MySqlListeningPracticeRepository } from "../src/infrastructure/persistence/mysql/MySqlListeningPracticeRepository.js";

const lessonUrl = new URL("../data/listening/bbc/260903-extreme-weather.json", import.meta.url);

async function storedLessonRow() {
  const definition = parseListeningLessonDefinition(
    JSON.parse(await readFile(lessonUrl, "utf8")),
    "260903-extreme-weather.json"
  );
  return {
    database_id: 1,
    public_id: definition.publicId,
    provider: definition.provider,
    slug: definition.slug,
    title: definition.title,
    description: definition.description,
    episode_code: definition.episodeCode,
    episode_date: definition.episodeDate,
    audio_url: definition.sourceUrl,
    schema_version: definition.schemaVersion,
    question_count: definition.questionCount,
    content_version: 1,
    content_json: JSON.stringify({ schemaVersion: definition.schemaVersion, groups: definition.groups })
  };
}

describe("MySqlListeningPracticeRepository JSON persistence", () => {
  it("loads one lesson JSON aggregate while keeping answer keys out of the public projection", async () => {
    const row = await storedLessonRow();
    const pool = {
      async execute() { return [[row]]; }
    };
    const repository = new MySqlListeningPracticeRepository(pool);

    const publicLesson = await repository.findPublishedLessonBySlug(
      "bbc_6_minute_english",
      "climate-change-extreme-weather"
    );
    const privateLesson = await repository.findPublishedLessonBySlug(
      "bbc_6_minute_english",
      "climate-change-extreme-weather",
      { includeAnswers: true }
    );

    assert.equal(publicLesson.groups.length, 4);
    assert.equal(publicLesson.questionCount, 13);
    assert.equal(Object.hasOwn(publicLesson.groups[0].questions[0], "acceptedAnswers"), false);
    assert.equal(Object.hasOwn(publicLesson.groups[1].questions[0], "correctOptionId"), false);
    assert.equal(privateLesson.groups[0].questions[0].acceptedAnswers[0].text, "day");
    assert.equal(
      privateLesson.groups[1].questions[0].correctOptionId,
      "bbc-260903-question-6-option-b"
    );
  });

  it("stores one submitted-answer JSON snapshot and one idempotent result JSON snapshot", async () => {
    const attemptRow = {
      database_id: 9,
      public_id: "attempt-1",
      user_id: "user-1",
      lesson_id: 1,
      lesson_content_version: 1,
      status: "active",
      started_at: new Date("2026-09-03T08:00:00.000Z"),
      submitted_at: null,
      total_count: 1
    };
    let updateValues = null;
    let resultJson = null;
    let updateCount = 0;
    const connection = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async execute(sql, values = []) {
        const compact = sql.replace(/\s+/gu, " ").trim();
        if (compact.includes("FROM listening_attempts") && compact.endsWith("FOR UPDATE")) {
          return [[{ ...attemptRow }]];
        }
        if (compact.startsWith("UPDATE listening_attempts")) {
          updateCount += 1;
          updateValues = values;
          resultJson = values[4];
          attemptRow.status = "completed";
          attemptRow.submitted_at = new Date("2026-09-03T08:06:00.000Z");
          return [{ affectedRows: 1 }];
        }
        if (compact.startsWith("SELECT correct_count")) {
          return [[{
            correct_count: 1,
            wrong_count: 0,
            total_count: 1,
            percentage: 100,
            submitted_at: attemptRow.submitted_at,
            result_json: resultJson
          }]];
        }
        throw new Error(`Unexpected SQL in JSON persistence test: ${compact}`);
      }
    };
    const pool = { async getConnection() { return connection; } };
    const repository = new MySqlListeningPracticeRepository(pool);
    const grade = {
      score: { correct: 1, wrong: 0, total: 1, percentage: 100 },
      results: [{
        questionId: "q1",
        number: 1,
        responseType: "text",
        submittedValue: "day",
        submittedAnswer: "day",
        correctAnswer: "day",
        correct: true
      }]
    };

    const first = await repository.completeAttempt("user-1", "attempt-1", grade);
    const second = await repository.completeAttempt("user-1", "attempt-1", grade);

    assert.equal(updateCount, 1);
    assert.deepEqual(second, first);
    assert.deepEqual(JSON.parse(updateValues[3]), {
      schemaVersion: 1,
      answers: [{ questionId: "q1", value: "day" }]
    });
    assert.deepEqual(JSON.parse(updateValues[4]), {
      schemaVersion: 1,
      results: [{
        questionId: "q1",
        number: 1,
        responseType: "text",
        submittedAnswer: "day",
        correctAnswer: "day",
        correct: true
      }]
    });
  });
});
