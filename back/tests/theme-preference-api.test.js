import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createTestContext } from "./helpers/fakes.js";

async function registeredAgent(app) {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/register")
    .send({ email: "theme@example.com", password: "password123" })
    .expect(201);
  return agent;
}

describe("theme preference API", () => {
  it("updates only the theme through the dedicated settings endpoint", async () => {
    const { app } = createTestContext();
    const agent = await registeredAgent(app);
    const state = {
      settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "system" },
      marker: "keep-me"
    };

    await agent
      .put("/api/state")
      .send({ state, revision: 0 })
      .expect(200, { revision: 1 });

    await agent
      .put("/api/settings/theme")
      .send({ theme: "dark", revision: 1 })
      .expect(200, { theme: "dark", revision: 2 });

    const current = await agent.get("/api/state").expect(200);
    assert.equal(current.body.revision, 2);
    assert.equal(current.body.state.settings.theme, "dark");
    assert.equal(current.body.state.settings.dailyGoal, 20);
    assert.equal(current.body.state.marker, "keep-me");
  });

  it("validates theme input and preserves optimistic concurrency", async () => {
    const { app } = createTestContext();
    const agent = await registeredAgent(app);
    const state = {
      settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "system" }
    };

    await agent
      .put("/api/state")
      .send({ state, revision: 0 })
      .expect(200, { revision: 1 });

    await agent
      .put("/api/settings/theme")
      .send({ theme: "sepia", revision: 1 })
      .expect(400, {
        error: {
          code: "INVALID_THEME",
          message: "Theme must be one of: system, light, dark."
        }
      });

    await agent
      .put("/api/settings/theme")
      .send({ theme: "light" })
      .expect(400, {
        error: {
          code: "INVALID_REVISION",
          message: "Revision must be a non-negative safe integer."
        }
      });

    await agent
      .put("/api/settings/theme")
      .send({ theme: "light", revision: 1 })
      .expect(200, { theme: "light", revision: 2 });

    await agent
      .put("/api/settings/theme")
      .send({ theme: "dark", revision: 1 })
      .expect(409, {
        error: {
          code: "STATE_CONFLICT",
          message: "Learning state was updated by another session. Reload and try again."
        }
      });
  });
});
