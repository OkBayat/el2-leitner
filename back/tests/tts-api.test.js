import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";
import { ValidationError } from "../src/domain/errors.js";

const directories = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function authenticatedContext(result) {
  const context = createTestContext();
  context.container.useCases.synthesizeSpeech = { execute: async () => result };
  const agent = request.agent(context.app);
  await agent
    .post("/api/auth/register")
    .send({ email: "tts@example.com", password: "password123" })
    .expect(201);
  return { agent, context };
}

describe("TTS HTTP API", () => {
  it("requires authentication and streams generated and cached audio through one response path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vocora-tts-api-"));
    directories.push(directory);
    const filePath = join(directory, "audio.mp3");
    await writeFile(filePath, Buffer.from("0123456789"));
    const result = {
      cacheKey: "a".repeat(64),
      cacheStatus: "hit",
      contentType: "audio/mpeg",
      filePath,
      format: "mp3"
    };
    const { app } = createTestContext();
    await request(app).post("/api/tts/speech").send({ text: "Hello." }).expect(401);

    const { agent } = await authenticatedContext(result);
    const response = await agent
      .post("/api/tts/speech")
      .send({ text: "Hello." })
      .expect(200);
    assert.match(response.headers["content-type"], /^audio\/mpeg/u);
    assert.equal(response.headers["x-vocora-tts-cache"], "hit");
    assert.deepEqual(response.body, Buffer.from("0123456789"));
  });

  it("returns the canonical backend error shape", async () => {
    const { agent, context } = await authenticatedContext(null);
    context.container.useCases.synthesizeSpeech = {
      async execute() {
        throw new ValidationError(
          "INVALID_TTS_VOICE",
          "The requested TTS voice is not supported."
        );
      }
    };
    await agent
      .post("/api/tts/speech")
      .send({ text: "Hello.", voice: "unknown" })
      .expect(400, {
        error: { code: "INVALID_TTS_VOICE", message: "The requested TTS voice is not supported." }
      });
  });
});
