import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import request from "supertest";

import { loadConfig } from "../src/config/loadConfig.js";
import { createContainer } from "../src/container.js";
import { createApp } from "../src/createApp.js";
import { NotFoundError } from "../src/domain/errors.js";
import { parseListeningLessonDefinition } from "../src/domain/listening-practice/ListeningLessonDefinition.js";
import {
  FakePasswordHasher,
  InMemoryLearningStateRepository,
  InMemoryLibraryRepository,
  InMemoryPracticeSessionRepository,
  InMemoryUserRepository
} from "./helpers/fakes.js";

const lessonUrl = new URL("../data/listening/bbc/260903-extreme-weather.json", import.meta.url);

class InMemoryListeningPracticeRepository {
  constructor(lesson) {
    this.lesson = { databaseId: 1, contentVersion: 1, ...structuredClone(lesson) };
    this.attempts = new Map();
    this.nextAttempt = 1;
    this.completeCalls = 0;
  }

  async listPublishedLessons(provider, userId) {
    if (provider !== this.lesson.provider) return [];
    const tests = this.lesson.tests.map((test) => {
      const completed = [...this.attempts.values()].filter((attempt) =>
        attempt.userId === String(userId)
        && attempt.testId === test.id
        && attempt.status === "completed"
      );
      return {
        ...structuredClone(test),
        completed: completed.length > 0,
        completedAt: completed.length ? "2026-09-03T08:06:00.000Z" : null
      };
    });
    return [{ ...structuredClone(this.lesson), tests }];
  }

  async findPublishedLessonBySlug(provider, slug) {
    if (provider !== this.lesson.provider || slug !== this.lesson.slug) {
      throw new NotFoundError("LISTENING_LESSON_NOT_FOUND", "Listening lesson was not found.");
    }
    return structuredClone(this.lesson);
  }

  async startAttempt(userId, lesson, test) {
    const attempt = {
      id: `attempt-${this.nextAttempt++}`,
      userId: String(userId),
      testId: test.id,
      lessonContentVersion: lesson.contentVersion,
      status: "active",
      startedAt: "2026-09-03T08:00:00.000Z",
      totalQuestions: test.questionCount
    };
    this.attempts.set(attempt.id, attempt);
    return structuredClone(attempt);
  }

  async getAttemptForGrading(userId, attemptId) {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || attempt.userId !== String(userId)) {
      throw new NotFoundError("LISTENING_ATTEMPT_NOT_FOUND", "Listening attempt was not found.");
    }
    const test = this.lesson.tests.find((candidate) => candidate.id === attempt.testId) || null;
    return attempt.completedResult
      ? { attempt: structuredClone(attempt), lesson: null, test: null, completedResult: structuredClone(attempt.completedResult) }
      : {
          attempt: structuredClone(attempt),
          lesson: structuredClone(this.lesson),
          test: structuredClone(test),
          completedResult: null
        };
  }

  async completeAttempt(userId, attemptId, grade) {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || attempt.userId !== String(userId)) {
      throw new NotFoundError("LISTENING_ATTEMPT_NOT_FOUND", "Listening attempt was not found.");
    }
    if (attempt.completedResult) return structuredClone(attempt.completedResult);
    this.completeCalls += 1;
    attempt.status = "completed";
    const result = {
      attempt: {
        id: attempt.id,
        testId: attempt.testId,
        status: "completed",
        startedAt: attempt.startedAt,
        submittedAt: "2026-09-03T08:06:00.000Z",
        totalQuestions: attempt.totalQuestions
      },
      score: grade.score,
      results: grade.results.map(({ submittedValue: _submittedValue, ...answer }) => answer)
    };
    attempt.completedResult = result;
    return structuredClone(result);
  }
}

async function createListeningTestContext() {
  const lesson = parseListeningLessonDefinition(
    JSON.parse(await readFile(lessonUrl, "utf8")),
    "260903-extreme-weather.json"
  );
  const listeningPracticeRepository = new InMemoryListeningPracticeRepository(lesson);
  const config = loadConfig({
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-at-least-thirty-two-characters",
    AUTH_COOKIE_NAME: "test_session",
    COOKIE_SECURE: "false"
  });
  const container = createContainer({
    config,
    adapters: {
      userRepository: new InMemoryUserRepository(),
      learningStateRepository: new InMemoryLearningStateRepository(),
      libraryRepository: new InMemoryLibraryRepository(),
      practiceSessionRepository: new InMemoryPracticeSessionRepository(),
      listeningPracticeRepository,
      passwordHasher: new FakePasswordHasher()
    }
  });
  return {
    app: createApp({
      container,
      staticDirectory: false,
      nodeEnv: "test",
      logger: { error() {} }
    }),
    listeningPracticeRepository
  };
}

async function register(app, email) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ email, password: "password123" }).expect(201);
  return agent;
}

function answerPayload() {
  const values = [
    [1, "day"], [2, "long term"], [3, "typhoons"], [4, "tropical"], [5, "slowly"],
    [6, "bbc-260903-question-6-option-b"], [7, "bbc-260903-question-7-option-a"],
    [8, "bbc-260903-question-8-option-a"], [9, "inland"], [10, "coast"],
    [11, "10 metres"], [12, "2C"]
  ];
  return {
    answers: values.map(([number, value]) => ({ questionId: `bbc-260903-question-${number}`, value }))
  };
}

const testPath = (testId) => `/api/listening/bbc/lessons/climate-change-extreme-weather/tests/${testId}/attempts`;

describe("BBC listening API", () => {
  it("requires authentication for catalog, test start and submission", async () => {
    const { app } = await createListeningTestContext();
    await request(app).get("/api/listening/bbc/lessons").expect(401);
    await request(app).post(testPath("test-1")).expect(401);
    await request(app).post("/api/listening/bbc/attempts/attempt-1/submit").send({ answers: [] }).expect(401);
  });

  it("lists three incomplete tests and starts only the selected test without exposing answer keys", async () => {
    const { app } = await createListeningTestContext();
    const learner = await register(app, "listening@example.com");

    const catalog = await learner.get("/api/listening/bbc/lessons").expect(200);
    assert.equal(catalog.headers["cache-control"], "no-store");
    assert.equal(catalog.body.lessons.length, 1);
    assert.equal(catalog.body.lessons[0].testCount, 3);
    assert.equal(catalog.body.lessons[0].questionCount, 39);
    assert.deepEqual(catalog.body.lessons[0].tests.map((test) => [test.id, test.completed]), [
      ["test-1", false], ["test-2", false], ["test-3", false]
    ]);

    const started = await learner.post(testPath("test-2")).expect(201);
    assert.equal(started.body.attempt.testId, "test-2");
    assert.equal(started.body.test.id, "test-2");
    assert.equal(started.body.test.questionCount, 13);
    const textQuestion = started.body.test.groups[0].questions[0];
    const choiceQuestion = started.body.test.groups[1].questions[0];
    assert.equal(Object.hasOwn(textQuestion, "acceptedAnswers"), false);
    assert.equal(Object.hasOwn(textQuestion, "answers"), false);
    assert.equal(Object.hasOwn(choiceQuestion, "correctOptionId"), false);
    assert.equal(Object.hasOwn(choiceQuestion.options[0], "correct"), false);
  });

  it("marks only the completed test in the catalog", async () => {
    const { app } = await createListeningTestContext();
    const learner = await register(app, "completion@example.com");
    const started = await learner.post(testPath("test-1")).expect(201);
    await learner
      .post(`/api/listening/bbc/attempts/${started.body.attempt.id}/submit`)
      .send(answerPayload())
      .expect(200);

    const catalog = await learner.get("/api/listening/bbc/lessons").expect(200);
    assert.deepEqual(catalog.body.lessons[0].tests.map((test) => [test.id, test.completed]), [
      ["test-1", true], ["test-2", false], ["test-3", false]
    ]);
    assert.ok(catalog.body.lessons[0].tests[0].completedAt);
  });

  it("grades an incomplete Test 1 submission and persists unanswered questions as incorrect idempotently", async () => {
    const { app, listeningPracticeRepository } = await createListeningTestContext();
    const learner = await register(app, "score@example.com");
    const started = await learner.post(testPath("test-1")).expect(201);

    const first = await learner
      .post(`/api/listening/bbc/attempts/${started.body.attempt.id}/submit`)
      .send(answerPayload())
      .expect(200);
    assert.equal(first.body.attempt.testId, "test-1");
    assert.deepEqual(first.body.score, { correct: 10, wrong: 3, total: 13, percentage: 76.9 });
    assert.equal(first.body.results[9].correctAnswer, "sea levels");
    assert.equal(first.body.results[12].submittedAnswer, "No answer");
    assert.equal(first.body.results[12].correct, false);

    const retry = await learner
      .post(`/api/listening/bbc/attempts/${started.body.attempt.id}/submit`)
      .send(answerPayload())
      .expect(200);
    assert.deepEqual(retry.body, first.body);
    assert.equal(listeningPracticeRepository.completeCalls, 1);
  });

  it("rejects an unknown test and cross-user attempt submission", async () => {
    const { app } = await createListeningTestContext();
    const firstLearner = await register(app, "first-listener@example.com");
    const secondLearner = await register(app, "second-listener@example.com");
    await firstLearner.post(testPath("test-99")).expect(404);

    const started = await firstLearner.post(testPath("test-1")).expect(201);
    await secondLearner
      .post(`/api/listening/bbc/attempts/${started.body.attempt.id}/submit`)
      .send(answerPayload())
      .expect(404, {
        error: { code: "LISTENING_ATTEMPT_NOT_FOUND", message: "Listening attempt was not found." }
      });
  });
});
