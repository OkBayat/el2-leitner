import assert from "node:assert/strict";
import express from "express";
import { describe, it } from "node:test";
import request from "supertest";

import { createCollectionLearningPathRouter } from "../src/interfaces/http/collection-learning-path/collectionLearningPathRouter.js";
import { createErrorHandler } from "../src/interfaces/http/errorHandler.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/domain/errors.js";

function createRouterHarness(overrides = {}) {
  const calls = [];
  const queries = {
    getCollectionLearningPath: {
      async execute(userId, collectionId) {
        calls.push(["getCollectionLearningPath", userId, collectionId]);
        return {
          path: {
            id: "path-1",
            collectionId,
            title: "Fixture path",
            mode: "finite",
            status: "published",
            contentVersion: 2,
            learnerStatus: "in_progress",
            sourceHash: "must-not-leak",
            retiredAt: null,
          },
          lessons: [{
            id: "lesson-1",
            title: "Lesson 1",
            position: 1,
            sourceKind: "fixture",
            sourceRef: "source-1",
            state: "available",
            progress: null,
            retiredVersion: 9,
            exercises: [{
              id: "exercise-1",
              position: 1,
              type: "fixture.exercise",
              schemaVersion: 1,
              required: true,
              completionPolicy: "explicit",
              config: { publicValue: true },
              state: "available",
              progress: null,
              introducedVersion: 1,
            }],
          }],
        };
      },
    },
    getLearningPathLesson: {
      async execute(userId, pathId, lessonId) {
        calls.push(["getLearningPathLesson", userId, pathId, lessonId]);
        return {
          id: lessonId,
          title: "Lesson 1",
          position: 1,
          sourceKind: "fixture",
          sourceRef: "source-1",
          state: "available",
          progress: null,
          exercises: [],
        };
      },
    },
    getExerciseContext: {
      async execute(userId, pathId, lessonId, exerciseId) {
        calls.push(["getExerciseContext", userId, pathId, lessonId, exerciseId]);
        return {
          path: { id: pathId, collectionId: "collection-1", title: "Fixture", mode: "finite", contentVersion: 2 },
          lesson: { id: lessonId, title: "Lesson 1", position: 1 },
          exercise: {
            id: exerciseId,
            position: 1,
            type: "fixture.exercise",
            schemaVersion: 1,
            required: true,
            completionPolicy: "explicit",
            config: { publicValue: true },
          },
          progress: null,
          state: "available",
          payload: { hydrated: true },
        };
      },
    },
    getLearningPathResumePoint: {
      async execute(userId, pathId) {
        calls.push(["getLearningPathResumePoint", userId, pathId]);
        return {
          pathId,
          pathStatus: "in_progress",
          resumePoint: { lessonId: "lesson-1", exerciseId: "exercise-1" },
        };
      },
    },
    ...overrides.queries,
  };
  const commands = {
    startLearningPath: {
      async execute(userId, pathId) {
        calls.push(["startLearningPath", userId, pathId]);
        return { pathId, pathStatus: "in_progress", resumePoint: { lessonId: "lesson-1", exerciseId: "exercise-1" } };
      },
    },
    startExercise: {
      async execute(userId, pathId, lessonId, exerciseId) {
        calls.push(["startExercise", userId, pathId, lessonId, exerciseId]);
        return { pathId, lessonId, exerciseId, exerciseStatus: "in_progress" };
      },
    },
    completeExercise: {
      async execute(userId, pathId, lessonId, exerciseId, outcome) {
        calls.push(["completeExercise", userId, pathId, lessonId, exerciseId, outcome]);
        return {
          pathId,
          lessonId,
          exerciseId,
          exerciseStatus: "completed",
          lessonStatus: "completed",
          pathStatus: "completed",
          resumePoint: null,
        };
      },
    },
    ...overrides.commands,
  };
  const authenticate = overrides.authenticate ?? ((req, _res, next) => {
    req.auth = { userId: "authenticated-user" };
    next();
  });
  const app = express();
  app.use(express.json());
  app.use("/api/learning-paths", createCollectionLearningPathRouter({ queries, commands, authenticate }));
  app.use(createErrorHandler({ logger: { error() {} }, nodeEnv: "test" }));
  return { app, calls };
}

describe("Collection Learning Path HTTP adapter", () => {
  it("keeps every route authenticated and uses only the server-side learner identity", async () => {
    const { app, calls } = createRouterHarness();

    await request(app).get("/api/learning-paths/collections/collection-1").expect(200);
    await request(app).post("/api/learning-paths/path-1/start").send({ userId: "forged-user" }).expect(200);
    await request(app)
      .post("/api/learning-paths/path-1/lessons/lesson-1/exercises/exercise-1/start")
      .send({ userId: "forged-user" })
      .expect(200);

    assert.ok(calls.every((call) => call[1] === "authenticated-user"));
    assert.ok(calls.every((call) => !call.includes("forged-user")));
  });

  it("exposes the complete Phase 3 read and command surface", async () => {
    const { app } = createRouterHarness();

    await request(app).get("/api/learning-paths/collections/collection-1").expect(200);
    await request(app).get("/api/learning-paths/path-1/lessons/lesson-1").expect(200);
    await request(app)
      .get("/api/learning-paths/path-1/lessons/lesson-1/exercises/exercise-1")
      .expect(200, {
        context: {
          path: { id: "path-1", collectionId: "collection-1", title: "Fixture", mode: "finite", contentVersion: 2 },
          lesson: { id: "lesson-1", title: "Lesson 1", position: 1 },
          exercise: {
            id: "exercise-1",
            position: 1,
            type: "fixture.exercise",
            schemaVersion: 1,
            required: true,
            completionPolicy: "explicit",
            config: { publicValue: true },
          },
          progress: null,
          state: "available",
          payload: { hydrated: true },
        },
      });
    await request(app).get("/api/learning-paths/path-1/resume").expect(200);
    await request(app).post("/api/learning-paths/path-1/start").expect(200);
    await request(app)
      .post("/api/learning-paths/path-1/lessons/lesson-1/exercises/exercise-1/start")
      .expect(200);
    await request(app)
      .post("/api/learning-paths/path-1/lessons/lesson-1/exercises/exercise-1/complete")
      .send({ outcome: { kind: "completed" } })
      .expect(200);
  });

  it("maps application views through explicit DTOs and does not leak persistence/content-management fields", async () => {
    const { app } = createRouterHarness();
    const response = await request(app).get("/api/learning-paths/collections/collection-1").expect(200);

    assert.equal(response.body.path.sourceHash, undefined);
    assert.equal(response.body.path.retiredAt, undefined);
    assert.equal(response.body.lessons[0].retiredVersion, undefined);
    assert.equal(response.body.lessons[0].exercises[0].introducedVersion, undefined);
    assert.deepEqual(response.body.lessons[0].exercises[0].config, { publicValue: true });
  });

  it("validates route identifiers and completion outcome envelopes before dispatch", async () => {
    const { app, calls } = createRouterHarness();

    await request(app).get("/api/learning-paths/collections/%20").expect(400, {
      error: { code: "INVALID_LEARNING_PATH_COLLECTION_ID", message: "A valid collection id is required." },
    });
    await request(app)
      .post("/api/learning-paths/path-1/lessons/lesson-1/exercises/exercise-1/complete")
      .send({ outcome: { kind: "cancelled" } })
      .expect(400, {
        error: { code: "INVALID_LEARNING_PATH_OUTCOME", message: "Only a completed exercise outcome can be submitted." },
      });
    assert.equal(calls.filter(([name]) => name === "completeExercise").length, 0);
  });

  it("preserves canonical 403, 404, and 409 application errors", async () => {
    const cases = [
      [new ForbiddenError("LEARNING_PATH_PROGRESS_FORBIDDEN", "Add this collection before starting its Learning Path."), 403],
      [new NotFoundError("LEARNING_PATH_NOT_FOUND", "Learning Path was not found."), 404],
      [new ConflictError("LEARNING_PATH_EXERCISE_LOCKED", "Exercise prerequisites are not complete."), 409],
      [new ValidationError("INVALID_LEARNING_PATH_ID", "A valid Learning Path id is required."), 400],
    ];

    for (const [error, expectedStatus] of cases) {
      const { app } = createRouterHarness({
        queries: {
          getLearningPathResumePoint: { async execute() { throw error; } },
        },
      });
      const response = await request(app).get("/api/learning-paths/path-1/resume").expect(expectedStatus);
      assert.equal(response.body.error.code, error.code);
    }
  });
});
