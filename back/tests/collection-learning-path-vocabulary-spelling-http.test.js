import assert from "node:assert/strict";
import express from "express";
import { it } from "node:test";
import request from "supertest";

import { createCollectionLearningPathRouter } from "../src/interfaces/http/collection-learning-path/collectionLearningPathRouter.js";

it("starts vocabulary spelling for the authenticated learner and selected scope", async () => {
  const calls = [];
  const noop = { async execute() { return {}; } };
  const commands = {
    startLearningPath: noop,
    startExercise: noop,
    completeExercise: noop,
    activateVocabularyIntake: noop,
    startVocabularyMasteryCheck: noop,
    startVocabularySpelling: {
      async execute(userId, pathId, lessonId, exerciseId, scope) {
        calls.push({ userId, pathId, lessonId, exerciseId, scope });
        return {
          pathId,
          lessonId,
          exerciseId,
          session: { id: "session-1" },
          payload: { scope, items: [], summary: { box: 1, eligibleCount: 0 } },
        };
      },
    },
  };
  const queries = {
    listAvailableCollections: noop,
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

  await request(app)
    .post("/api/learning-paths/1/lessons/5/exercises/10/vocabulary-spelling/start")
    .send({ userId: "forged-user", scope: "course" })
    .expect(201);

  assert.deepEqual(calls, [{
    userId: "authenticated-user",
    pathId: "1",
    lessonId: "5",
    exerciseId: "10",
    scope: "course",
  }]);
});
