import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";

describe("Leitner house detail API", () => {
  it("requires authentication", async () => {
    const { app } = createTestContext();

    await request(app).get("/api/learning/boxes/1").expect(401, {
      error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." }
    });
  });

  it("returns only the authenticated learner's active words from the selected house", async () => {
    const { app } = createTestContext();
    const learner = request.agent(app);

    await learner
      .post("/api/auth/register")
      .send({ email: "learner@example.com", password: "password123" })
      .expect(201);

    await learner
      .put("/api/state")
      .send({
        revision: 0,
        state: {
          words: [
            {
              id: "h1-hard",
              number: 1,
              term: "facilities",
              accepted: ["facilities"],
              category: "General",
              tags: [],
              lessons: [],
              box: 1,
              due: "2026-08-30",
              attempts: 20,
              correct: 6,
              mistakes: 14,
              lastReviewed: "2026-08-31T10:00:00.000Z"
            },
            {
              id: "h2",
              number: 2,
              term: "spacious",
              accepted: ["spacious"],
              category: "Home",
              tags: [],
              lessons: [],
              box: 2,
              due: "2026-09-03",
              attempts: 4,
              correct: 2,
              mistakes: 2,
              lastReviewed: null
            },
            {
              id: "h5-mastered",
              number: 3,
              term: "finished",
              accepted: ["finished"],
              category: "General",
              tags: [],
              lessons: [],
              box: 5,
              due: null,
              attempts: 9,
              correct: 9,
              mistakes: 0,
              masteredAt: "2026-08-31T12:00:00.000Z"
            }
          ]
        }
      })
      .expect(200, { revision: 1 });

    const response = await learner.get("/api/learning/boxes/1").expect(200);

    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.body.house.number, 1);
    assert.equal(response.body.house.reviewIntervalDays, 1);
    assert.equal(response.body.summary.totalWords, 1);
    assert.equal(response.body.summary.totalMistakes, 14);
    assert.deepEqual(response.body.words.map((word) => word.id), ["h1-hard"]);

    const boxFive = await learner.get("/api/learning/boxes/5").expect(200);
    assert.equal(boxFive.body.summary.totalWords, 0);
    assert.deepEqual(boxFive.body.words, []);
  });

  it("rejects invalid house numbers with the canonical validation error", async () => {
    const { app } = createTestContext();
    const learner = request.agent(app);

    await learner
      .post("/api/auth/register")
      .send({ email: "learner@example.com", password: "password123" })
      .expect(201);

    await learner.get("/api/learning/boxes/6").expect(400, {
      error: {
        code: "INVALID_LEITNER_HOUSE",
        message: "Leitner house must be an integer between 1 and 5."
      }
    });
  });
});
