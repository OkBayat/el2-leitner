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
    source_url: definition.sourceUrl,
    schema_version: definition.schemaVersion,
    question_count: definition.questionCount,
    content_version: 1,
    content_json: JSON.stringify({ schemaVersion: definition.schemaVersion, tests: definition.tests })
  };
}

describe("MySqlListeningPracticeRepository JSON persistence", () => {
  it("loads three tests from one lesson aggregate while keeping answer keys out of the public projection", async () => {
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

    assert.equal(publicLesson.testCount, 3);
    assert.equal(publicLesson.questionCount, 39);
    assert.equal(publicLesson.tests[0].questionCount, 13);
    assert.equal(publicLesson.sourceUrl, row.source_url);
    assert.equal(Object.hasOwn(publicLesson.tests[0].groups[0].questions[0], "acceptedAnswers"), false);
    assert.equal(Object.hasOwn(publicLesson.tests[0].groups[1].questions[0], "correctOptionId"), false);
    assert.equal(privateLesson.tests[0].groups[0].questions[0].acceptedAnswers[0].text, "day");
    assert.equal(
      privateLesson.tests[0].groups[1].questions[0].correctOptionId,
      "bbc-260903-question-6-option-b"
    );
  });

  it("reports completion separately for each test", async () => {
    const row = await storedLessonRow();
    let call = 0;
    const pool = {
      async execute() {
        call += 1;
        if (call === 1) return [[row]];
        return [[{
          lesson_id: 1,
          test_id: "test-2",
          completed_at: new Date("2026-09-03T09:00:00.000Z")
        }]];
      }
    };
    const repository = new MySqlListeningPracticeRepository(pool);
    const lessons = await repository.listPublishedLessons("bbc_6_minute_english", "user-1");

    assert.deepEqual(lessons[0].tests.map((test) => [test.id, test.completed]), [
      ["test-1", false], ["test-2", true], ["test-3", false]
    ]);
    assert.equal(lessons[0].tests[1].completedAt, "2026-09-03T09:00:00.000Z");
  });

  it("stores test identity with one submitted-answer JSON snapshot and one idempotent result snapshot", async () => {
    const attemptRow = {
      database_id: 9,
      public_id: "attempt-1",
      user_id: "user-1",
      lesson_id: 1,
      test_id: "test-2",
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

    assert.equal(first.attempt.testId, "test-2");
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
