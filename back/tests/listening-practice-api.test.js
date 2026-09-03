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

  async listPublishedLessons(provider) {
    if (provider !== this.lesson.provider) return [];
    const { groups: _groups, ...summary } = this.lesson;
    return [structuredClone(summary)];
  }

  async findPublishedLessonBySlug(provider, slug) {
    if (provider !== this.lesson.provider || slug !== this.lesson.slug) {
      throw new NotFoundError("LISTENING_LESSON_NOT_FOUND", "Listening lesson was not found.");
    }
    return structuredClone(this.lesson);
  }

  async startAttempt(userId, lesson) {
    const attempt = {
      id: `attempt-${this.nextAttempt++}`,
      userId: String(userId),
      lessonContentVersion: lesson.contentVersion,
      status: "active",
      startedAt: "2026-09-03T08:00:00.000Z",
      totalQuestions: lesson.questionCount
    };
    this.attempts.set(attempt.id, attempt);
    return structuredClone(attempt);
  }

  async getAttemptForGrading(userId, attemptId) {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || attempt.userId !== String(userId)) {
      throw new NotFoundError("LISTENING_ATTEMPT_NOT_FOUND", "Listening attempt was not found.");
    }
    return attempt.completedResult
      ? { attempt: structuredClone(attempt), lesson: null, completedResult: structuredClone(attempt.completedResult) }
      : { attempt: structuredClone(attempt), lesson: structuredClone(this.lesson), completedResult: null };
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

describe("BBC listening API", () => {
  it("requires authentication for catalog, attempt start and submission", async () => {
    const { app } = await createListeningTestContext();
    await request(app).get("/api/listening/bbc/lessons").expect(401);
    await request(app).post("/api/listening/bbc/lessons/climate-change-extreme-weather/attempts").expect(401);
    await request(app).post("/api/listening/bbc/attempts/attempt-1/submit").send({ answers: [] }).expect(401);
  });

  it("lists the seeded lesson and starts an attempt without exposing answer keys", async () => {
    const { app } = await createListeningTestContext();
    const learner = await register(app, "listening@example.com");

    const catalog = await learner.get("/api/listening/bbc/lessons").expect(200);
    assert.equal(catalog.headers["cache-control"], "no-store");
    assert.equal(catalog.body.lessons.length, 1);
    assert.equal(catalog.body.lessons[0].questionCount, 13);

    const started = await learner
      .post("/api/listening/bbc/lessons/climate-change-extreme-weather/attempts")
      .expect(201);
    assert.equal(started.body.lesson.groups.length, 4);
    assert.equal(started.body.lesson.questionCount, 13);
    const textQuestion = started.body.lesson.groups[0].questions[0];
    const choiceQuestion = started.body.lesson.groups[1].questions[0];
    assert.equal(Object.hasOwn(textQuestion, "acceptedAnswers"), false);
    assert.equal(Object.hasOwn(textQuestion, "answers"), false);
    assert.equal(Object.hasOwn(choiceQuestion, "correctOptionId"), false);
    assert.equal(Object.hasOwn(choiceQuestion.options[0], "correct"), false);
  });

  it("grades an incomplete submission and persists unanswered questions as incorrect idempotently", async () => {
    const { app, listeningPracticeRepository } = await createListeningTestContext();
    const learner = await register(app, "score@example.com");
    const started = await learner
      .post("/api/listening/bbc/lessons/climate-change-extreme-weather/attempts")
      .expect(201);

    const first = await learner
      .post(`/api/listening/bbc/attempts/${started.body.attempt.id}/submit`)
      .send(answerPayload())
      .expect(200);
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

  it("does not allow one learner to submit another learner's attempt", async () => {
    const { app } = await createListeningTestContext();
    const firstLearner = await register(app, "first-listener@example.com");
    const secondLearner = await register(app, "second-listener@example.com");
    const started = await firstLearner
      .post("/api/listening/bbc/lessons/climate-change-extreme-weather/attempts")
      .expect(201);

    await secondLearner
      .post(`/api/listening/bbc/attempts/${started.body.attempt.id}/submit`)
      .send(answerPayload())
      .expect(404, {
        error: { code: "LISTENING_ATTEMPT_NOT_FOUND", message: "Listening attempt was not found." }
      });
  });
});
