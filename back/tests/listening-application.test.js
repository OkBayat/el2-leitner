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
  it("keeps catalog reads and attempt writes separate while hiding answer keys", async () => {
    const lesson = await fixture();
    const calls = [];
    const repository = {
      async listPublishedLessons(provider) {
        calls.push(["list", provider]);
        return [lesson];
      },
      async findPublishedLessonBySlug(provider, slug, options) {
        calls.push(["find", provider, slug, options]);
        return lesson;
      },
      async startAttempt(userId) {
        calls.push(["start", userId]);
        return {
          id: "attempt-1",
          status: "active",
          startedAt: "2026-09-03T08:00:00.000Z",
          totalQuestions: 13
        };
      }
    };

    const catalog = await new ListListeningLessons({ listeningPracticeRepository: repository }).execute();
    const started = await new StartListeningAttempt({ listeningPracticeRepository: repository })
      .execute("user-1", lesson.slug);

    assert.equal(catalog.lessons[0].questionCount, 13);
    assert.equal(started.lesson.groups.length, 4);
    assert.equal(Object.hasOwn(started.lesson.groups[0].questions[0], "acceptedAnswers"), false);
    assert.equal(Object.hasOwn(started.lesson.groups[1].questions[0], "correctOptionId"), false);
    assert.deepEqual(calls[1], [
      "find",
      "bbc_6_minute_english",
      "climate-change-extreme-weather",
      { includeAnswers: false }
    ]);
  });

  it("grades through the domain and delegates one completed result write", async () => {
    const lesson = await fixture();
    let savedGrade;
    const repository = {
      async getAttemptForGrading() {
        return {
          attempt: { id: "attempt-1", lessonContentVersion: 1 },
          lesson,
          completedResult: null
        };
      },
      async completeAttempt(_userId, _attemptId, grade) {
        savedGrade = grade;
        return { attempt: { id: "attempt-1" }, ...grade };
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
          attempt: { id: "attempt-1", lessonContentVersion: 1 },
          lesson: { ...lesson, contentVersion: 2 },
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
