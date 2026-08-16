import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/createApp.js";

function appWith(useCases) {
  return createApp({
    config: {
      auth: {
        cookie: { name: "vocora_session", options: {} },
        rateLimit: { windowMs: 60000, max: 100 }
      },
      cors: { allowedOrigins: [] }
    },
    container: {
      tokenService: { verify: () => ({ sub: "7" }) },
      authCookie: { name: "vocora_session", options: {} },
      authRateLimit: { windowMs: 60000, max: 100 },
      useCases: {
        getCurrentUser: { execute: async () => ({ id: 7, email: "test@example.com" }) },
        ...useCases
      }
    }
  });
}

describe("GET /api/library/vocabulary-sources", () => {
  it("passes only the requested ids to the scoped query", async () => {
    const calls = [];
    const app = appWith({
      getVocabularySources: {
        async execute(userId, input) {
          calls.push({ userId, input });
          return { sources: [{ vocabularyId: "vocab-1", term: "one", collections: [] }] };
        }
      }
    });

    const response = await request(app)
      .get("/api/library/vocabulary-sources?ids=vocab-1,vocab-2")
      .set("Cookie", "vocora_session=token")
      .expect(200);

    assert.equal(response.body.sources.length, 1);
    assert.deepEqual(calls, [{ userId: 7, input: { ids: "vocab-1,vocab-2" } }]);
  });
});
