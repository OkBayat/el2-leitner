import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { ListListeningLessons } from "../src/application/listening-practice/ListListeningLessons.js";
import { StartListeningAttempt } from "../src/application/listening-practice/StartListeningAttempt.js";
import { SubmitListeningAttempt } from "../src/application/listening-practice/SubmitListeningAttempt.js";
import { parseListeningLessonDefinition } from "../src/domain/listening-practice/ListeningLessonDefinition.js";

const lessonUrl = new URL("../data/listening/bbc/260903-extreme-weather.json", import.meta.url);

async function fixture() {
  return {
    databaseId: 1,
    contentVersion: 1,
    ...parseListeningLessonDefinition(
      JSON.parse(await readFile(lessonUrl, "utf8")),
      "260903-extreme-weather.json"
    )
  };
}

describe("Listening practice CQRS use cases", () => {
  it("lists test completion and starts only the selected test without exposing answer keys", async () => {
    const lesson = await fixture();
    const catalogLesson = {
      ...lesson,
      tests: lesson.tests.map((test, index) => ({
        ...test,
        completed: index === 0,
        completedAt: index === 0 ? "2026-09-03T08:10:00.000Z" : null
      }))
    };
    const calls = [];
    const repository = {
      async listPublishedLessons(provider, userId) {
        calls.push(["list", provider, userId]);
        return [catalogLesson];
      },
      async findPublishedLessonBySlug(provider, slug, options) {
        calls.push(["find", provider, slug, options]);
        return lesson;
      },
      async startAttempt(userId, _lesson, test) {
        calls.push(["start", userId, test.id]);
        return {
          id: "attempt-1",
          testId: test.id,
          status: "active",
          startedAt: "2026-09-03T08:00:00.000Z",
          totalQuestions: test.questionCount
        };
      }
    };

    const catalog = await new ListListeningLessons({ listeningPracticeRepository: repository }).execute("user-1");
    const started = await new StartListeningAttempt({ listeningPracticeRepository: repository })
      .execute("user-1", lesson.slug, "test-2");

    assert.equal(catalog.lessons[0].testCount, 3);
    assert.equal(catalog.lessons[0].tests[0].completed, true);
    assert.equal(catalog.lessons[0].tests[1].completed, false);
    assert.equal(started.test.id, "test-2");
    assert.equal(started.test.questionCount, 13);
    assert.equal(started.attempt.testId, "test-2");
    assert.equal(Object.hasOwn(started.test.groups[0].questions[0], "acceptedAnswers"), false);
    assert.equal(Object.hasOwn(started.test.groups[1].questions[0], "correctOptionId"), false);
    assert.deepEqual(calls[0], ["list", "bbc_6_minute_english", "user-1"]);
    assert.deepEqual(calls[1], [
      "find",
      "bbc_6_minute_english",
      "climate-change-extreme-weather",
      { includeAnswers: false }
    ]);
    assert.deepEqual(calls[2], ["start", "user-1", "test-2"]);
  });

  it("rejects an unknown test before starting an attempt", async () => {
    const lesson = await fixture();
    let started = false;
    const repository = {
      async findPublishedLessonBySlug() { return lesson; },
      async startAttempt() { started = true; }
    };
    await assert.rejects(
      () => new StartListeningAttempt({ listeningPracticeRepository: repository })
        .execute("user-1", lesson.slug, "test-99"),
      (error) => error.code === "LISTENING_TEST_NOT_FOUND"
    );
    assert.equal(started, false);
  });

  it("grades the test selected by the attempt and delegates one completed result write", async () => {
    const lesson = await fixture();
    const test = lesson.tests[0];
    let savedGrade;
    const repository = {
      async getAttemptForGrading() {
        return {
          attempt: { id: "attempt-1", testId: "test-1", lessonContentVersion: 1 },
          lesson,
          test,
          completedResult: null
        };
      },
      async completeAttempt(_userId, _attemptId, grade) {
        savedGrade = grade;
        return { attempt: { id: "attempt-1", testId: "test-1" }, ...grade };
      }
    };
    const result = await new SubmitListeningAttempt({ listeningPracticeRepository: repository }).execute(
      "user-1",
      "attempt-1",
      { answers: [{ questionId: "bbc-260903-question-1", value: "day" }] }
    );
    assert.equal(savedGrade.score.total, 13);
    assert.equal(savedGrade.results[0].correct, true);
    assert.equal(result.score.correct, 1);
  });

  it("rejects grading against a lesson version that changed after the attempt started", async () => {
    const lesson = await fixture();
    const repository = {
      async getAttemptForGrading() {
        return {
          attempt: { id: "attempt-1", testId: "test-1", lessonContentVersion: 1 },
          lesson: { ...lesson, contentVersion: 2 },
          test: lesson.tests[0],
          completedResult: null
        };
      }
    };
    await assert.rejects(
      () => new SubmitListeningAttempt({ listeningPracticeRepository: repository }).execute(
        "user-1",
        "attempt-1",
        { answers: [] }
      ),
      (error) => error.code === "LISTENING_LESSON_UPDATED"
    );
  });
});
