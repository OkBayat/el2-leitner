import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";

const deck = {
  practice: { mode: "sentence", house: 1, retryGap: 3 },
  summary: { totalWords: 1, totalSentences: 3 },
  cards: [{
    id: "word-name",
    term: "name",
    accepted: ["name"],
    box: 1,
    mistakes: 0,
    sentences: [{
      id: "sentence-1",
      sourceItemNumber: 1,
      variantNumber: 1,
      category: "Personal details and form completion",
      text: "My name is Mohammad.",
      before: "My ",
      after: " is Mohammad.",
    }],
  }],
};

describe("Sentence practice API", () => {
  it("requires authentication", async () => {
    const { app } = createTestContext();

    await request(app).get("/api/learning/sentence-practice?house=1").expect(401, {
      error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." },
    });
  });

  it("rejects an invalid house before querying persistence", async () => {
    const { app } = createTestContext();
    const learner = request.agent(app);

    await learner
      .post("/api/auth/register")
      .send({ email: "invalid-house@example.com", password: "password123" })
      .expect(201);

    await learner.get("/api/learning/sentence-practice?house=6").expect(400, {
      error: {
        code: "INVALID_LEITNER_HOUSE",
        message: "Leitner house must be an integer between 1 and 5.",
      },
    });
  });

  it("returns a sentence deck for the authenticated learner and selected house", async () => {
    const { app, container } = createTestContext();
    const calls = [];
    container.useCases.getSentencePracticeCards = {
      async execute(userId, house) {
        calls.push({ userId: String(userId), house });
        return deck;
      },
    };
    const learner = request.agent(app);
    const registration = await learner
      .post("/api/auth/register")
      .send({ email: "sentence@example.com", password: "password123" })
      .expect(201);

    const response = await learner.get("/api/learning/sentence-practice?house=1").expect(200);

    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(response.body, deck);
    assert.deepEqual(calls, [{ userId: String(registration.body.user.id), house: "1" }]);
  });
});
