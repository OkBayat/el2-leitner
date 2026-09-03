import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import request from "supertest";

import { loadConfig } from "../src/config/loadConfig.js";
import { createContainer } from "../src/container.js";
import { createApp } from "../src/createApp.js";
import {
  FakePasswordHasher,
  InMemoryLearningStateRepository,
  InMemoryLibraryRepository,
  InMemoryPracticeSessionRepository,
  InMemoryUserRepository
} from "./helpers/fakes.js";

const AUDIO_FILE = "bbc-6-minute-english-260903.mp3";
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function context({ withFile = true } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vocora-listening-audio-"));
  temporaryDirectories.push(directory);
  if (withFile) await writeFile(path.join(directory, AUDIO_FILE), Buffer.from("0123456789abcdef"));

  const listeningPracticeRepository = {
    async findPublishedAudioBySlug(provider, slug) {
      assert.equal(provider, "bbc_6_minute_english");
      assert.equal(slug, "climate-change-extreme-weather");
      return { audioFile: AUDIO_FILE };
    }
  };
  const config = loadConfig({
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-at-least-thirty-two-characters",
    AUTH_COOKIE_NAME: "test_session",
    COOKIE_SECURE: "false",
    LISTENING_AUDIO_DIRECTORY: directory
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
  const app = createApp({ container, staticDirectory: false, nodeEnv: "test", logger: { error() {} } });
  return { app };
}

async function learner(app) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ email: "audio@example.com", password: "password123" }).expect(201);
  return agent;
}

describe("BBC listening episode audio", () => {
  it("requires authentication and streams byte ranges for browser seeking", async () => {
    const { app } = await context();
    const endpoint = "/api/listening/bbc/lessons/climate-change-extreme-weather/audio";
    await request(app).get(endpoint).expect(401);

    const agent = await learner(app);
    const response = await agent.get(endpoint).set("Range", "bytes=0-3").expect(206);
    assert.match(response.headers["content-type"], /^audio\/mpeg/u);
    assert.equal(response.headers["accept-ranges"], "bytes");
    assert.equal(response.headers["content-range"], "bytes 0-3/16");
  });

  it("returns a clear 404 when the local mp3 has not been installed", async () => {
    const { app } = await context({ withFile: false });
    const agent = await learner(app);
    await agent
      .get("/api/listening/bbc/lessons/climate-change-extreme-weather/audio")
      .expect(404, {
        error: { code: "LISTENING_AUDIO_NOT_FOUND", message: "Listening episode audio was not found." }
      });
  });
});
