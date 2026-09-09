import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/createApp.js";

function appWith(excludeVocabulary) {
  return createApp({
    staticDirectory: null,
    container: {
      tokenService: { verify: () => ({ userId: 7 }) },
      authCookie: { name: "vocora_session", options: {} },
      authRateLimit: { windowMs: 60000, max: 100 },
      useCases: {
        getCurrentUser: { execute: async () => ({ id: 7, email: "test@example.com" }) },
        excludeVocabulary
      }
    }
  });
}

describe("POST /api/learning/vocabulary-exclusions", () => {
  it("forwards the learner-owned exclusion command", async () => {
    const calls = [];
    const app = appWith({
      async execute(userId, input) {
        calls.push({ userId, input });
        return { revision: input.revision + 1 };
      }
    });
    const payload = { revision: 8, vocabularyId: "vocab-monday" };

    const response = await request(app)
      .post("/api/learning/vocabulary-exclusions")
      .set("Cookie", "vocora_session=token")
      .send(payload)
      .expect(200);

    assert.deepEqual(response.body, { revision: 9 });
    assert.deepEqual(calls, [{ userId: 7, input: payload }]);
  });
});
