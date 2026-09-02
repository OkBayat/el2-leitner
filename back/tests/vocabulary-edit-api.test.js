import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";

describe("compact vocabulary edit API", () => {
  it("updates one vocabulary item, advances revision, and returns it on the next state read", async () => {
    const { app } = createTestContext();
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: "word-edit@example.com", password: "password123" })
      .expect(201);

    const initialState = {
      schemaVersion: 2,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: "system" },
      words: [{
        id: "vocab-1",
        number: 1,
        term: "circumstance",
        accepted: ["circumstance"],
        category: "Discussion",
        tags: [],
        lessons: [],
        notes: "",
        createdAt: "2026-09-01T00:00:00.000Z",
        box: 1,
        due: "2099-01-01",
        attempts: 0,
        correct: 0,
        mistakes: 0,
        currentStreak: 0,
        introducedOn: "2026-09-01",
        addedSource: "daily",
        lastReviewed: null,
        lastPromotedDay: null,
        blockedUntil: null,
        masteredAt: null
      }],
      daily: {},
      history: []
    };

    await agent.put("/api/state").send({ state: initialState, revision: 0 }).expect(200, { revision: 1 });

    const edit = await agent
      .put("/api/learning/vocabulary/vocab-1")
      .send({
        revision: 1,
        term: "circumstances",
        acceptedForms: ["circumstances", "circumstance"],
        category: "Discussion",
        notes: "plural preferred"
      })
      .expect(200);

    assert.equal(edit.body.revision, 2);
    assert.deepEqual(edit.body.word, {
      id: "vocab-1",
      term: "circumstances",
      accepted: ["circumstances", "circumstance"],
      category: "Discussion",
      notes: "plural preferred"
    });

    const reloaded = await agent.get("/api/state").expect(200);
    assert.equal(reloaded.body.revision, 2);
    assert.equal(reloaded.body.state.words[0].term, "circumstances");
    assert.deepEqual(reloaded.body.state.words[0].accepted, ["circumstances", "circumstance"]);
    assert.equal(reloaded.body.state.words[0].notes, "plural preferred");
  });

  it("rejects a stale compact edit revision instead of overwriting newer state", async () => {
    const { app } = createTestContext();
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: "word-edit-conflict@example.com", password: "password123" })
      .expect(201);

    await agent.put("/api/state").send({
      state: { words: [{ id: "vocab-1", term: "word", accepted: ["word"], category: "Test", notes: "" }] },
      revision: 0
    }).expect(200, { revision: 1 });

    await agent
      .put("/api/learning/vocabulary/vocab-1")
      .send({ revision: 0, term: "words", acceptedForms: ["words"], category: "Test", notes: "" })
      .expect(409, {
        error: {
          code: "STATE_CONFLICT",
          message: "Learning state was updated by another session. Reload and try again."
        }
      });
  });
});
