import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/createApp.js";

function appWith(getLearningState) {
  return createApp({
    staticDirectory: null,
    container: {
      tokenService: { verify: () => ({ userId: 7 }) },
      authCookie: { name: "vocora_session", options: {} },
      authRateLimit: { windowMs: 60000, max: 100 },
      useCases: {
        getCurrentUser: { execute: async () => ({ id: 7, email: "test@example.com" }) },
        getLearningState
      }
    }
  });
}

describe("GET /api/state views", () => {
  it("keeps normal state reads lean while allowing an explicit full view", async () => {
    const calls = [];
    const app = appWith({
      async execute(userId, input) {
        calls.push({ userId, input });
        return { state: { words: [], history: [] }, revision: 4 };
      }
    });

    await request(app)
      .get("/api/state")
      .set("Cookie", "vocora_session=token")
      .expect(200);
    await request(app)
      .get("/api/state?view=full")
      .set("Cookie", "vocora_session=token")
      .expect(200);

    assert.deepEqual(calls, [
      { userId: 7, input: { view: undefined } },
      { userId: 7, input: { view: "full" } }
    ]);
  });
});
