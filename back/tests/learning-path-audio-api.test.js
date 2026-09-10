import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import express from "express";
import request from "supertest";

import { createErrorHandler } from "../src/interfaces/http/errorHandler.js";
import { createCollectionLearningPathRouter } from "../src/interfaces/http/collection-learning-path/collectionLearningPathRouter.js";

const ENDPOINT = "/api/learning-paths/4/lessons/64/audio";

async function context(t, { managedLessonId = "gfi-unit-01", withFile = true } = {}) {
  const audioDirectory = await mkdtemp(path.join(os.tmpdir(), "vocora-learning-path-audio-"));
  t.after(() => rm(audioDirectory, { recursive: true, force: true }));
  if (withFile) {
    await writeFile(
      path.join(audioDirectory, "gfi-unit-01.m4a"),
      Buffer.from("0123456789abcdef"),
    );
  }

  const calls = [];
  const queries = {
    getLearningPathLesson: {
      async execute(userId, pathId, lessonId) {
        calls.push([userId, pathId, lessonId]);
        return { id: managedLessonId, publicId: lessonId, title: "Unit 1 — Present tenses" };
      },
    },
  };
  const authenticate = (req, res, next) => {
    if (req.get("Authorization") !== "Bearer learner") {
      res.status(401).json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required." } });
      return;
    }
    req.auth = { userId: "learner-1" };
    next();
  };
  const app = express();
  app.use(
    "/api/learning-paths",
    createCollectionLearningPathRouter({ queries, commands: {}, authenticate, audioDirectory }),
  );
  app.use(createErrorHandler({ logger: { error() {} }, nodeEnv: "test" }));
  const get = () => request(app).get(ENDPOINT).set("Authorization", "Bearer learner");
  return { app, calls, get };
}

test("Learning Path audio requires authentication and streams byte ranges", async (t) => {
  const { app, calls, get } = await context(t);
  await request(app).get(ENDPOINT).expect(401);

  const response = await get().set("Range", "bytes=4-7").expect(206);
  assert.match(response.headers["content-type"], /^audio\/mp4/u);
  assert.equal(response.headers["accept-ranges"], "bytes");
  assert.equal(response.headers["content-range"], "bytes 4-7/16");
  assert.equal(response.headers["content-length"], "4");
  assert.deepEqual(calls, [["learner-1", "4", "64"]]);
});

test("Learning Path audio resolves only managed lesson M4A files from the shared audio directory", async (t) => {
  const missing = await context(t, { withFile: false });
  await missing.get().expect(404, {
    error: { code: "LISTENING_AUDIO_NOT_FOUND", message: "Listening episode audio was not found." },
  });

  const traversal = await context(t, { managedLessonId: "../gfi-unit-01" });
  await traversal.get().expect(404, {
    error: { code: "LISTENING_AUDIO_NOT_FOUND", message: "Listening episode audio was not found." },
  });
});
