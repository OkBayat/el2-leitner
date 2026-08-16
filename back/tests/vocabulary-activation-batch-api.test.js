import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/createApp.js";

function appWith(useCases) {
  return createApp({
    staticDirectory: null,
    container: {
      tokenService: { verify: () => ({ userId: 7 }) },
      authCookie: { name: "vocora_session", options: {} },
      authRateLimit: { windowMs: 60000, max: 100 },
      useCases: {
        getCurrentUser: { execute: async () => ({ id: 7, email: "test@example.com" }) },
        ...useCases
      }
    }
  });
}

describe("POST /api/learning/vocabulary-activation-batches", () => {
  it("forwards one compact batch without a full learning state", async () => {
    const calls = [];
    const app = appWith({
      activateVocabularyBatch: {
        async execute(userId, input) {
          calls.push({ userId, input });
          return { revision: input.revision + 1 };
        }
      }
    });

    const payload = {
      revision: 4949,
      vocabularyIds: ["vocab-1", "vocab-2"],
      day: "2026-08-16",
      source: "daily"
    };
    const response = await request(app)
      .post("/api/learning/vocabulary-activation-batches")
      .set("Cookie", "vocora_session=token")
      .send(payload)
      .expect(200);

    assert.deepEqual(response.body, { revision: 4950 });
    assert.deepEqual(calls, [{ userId: 7, input: payload }]);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "state"), false);
  });
});
