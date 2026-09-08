import assert from "node:assert/strict";
import express from "express";
import { it } from "node:test";
import request from "supertest";

import { createCollectionLearningPathRouter } from "../src/interfaces/http/collection-learning-path/collectionLearningPathRouter.js";

it("vocabulary intake activation is an authenticated type-specific Learning Path command", async () => {
  const calls = [];
  const noop = { async execute() { return {}; } };
  const commands = {
    startLearningPath: noop,
    startExercise: noop,
    completeExercise: noop,
    activateVocabularyIntake: {
      async execute(userId, pathId, lessonId, exerciseId) {
        calls.push({ userId, pathId, lessonId, exerciseId });
        return {
          pathId,
          lessonId,
          exerciseId,
          exerciseStatus: "in_progress",
          activatedCount: 2,
          revision: 8,
          summary: { total: 4, newCount: 0, learningCount: 3, masteredCount: 1, excludedCount: 0 },
        };
      },
    },
  };
  const queries = {
    getCollectionLearningPath: noop,
    getLearningPathLesson: noop,
    getExerciseContext: noop,
    getLearningPathResumePoint: noop,
  };
  const authenticate = (req, _res, next) => {
    req.auth = { userId: "authenticated-user" };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use("/api/learning-paths", createCollectionLearningPathRouter({ queries, commands, authenticate }));

  const response = await request(app)
    .post("/api/learning-paths/1/lessons/5/exercises/10/vocabulary-intake/activate")
    .send({ userId: "forged-user" })
    .expect(200);

  assert.equal(response.body.activatedCount, 2);
  assert.deepEqual(calls, [{
    userId: "authenticated-user",
    pathId: "1",
    lessonId: "5",
    exerciseId: "10",
  }]);
});
