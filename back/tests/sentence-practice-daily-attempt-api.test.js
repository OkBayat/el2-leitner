import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createTestContext } from "./helpers/fakes.js";

describe("Sentence practice daily attempt API", () => {
  it("records a sentence-practice answer against the current local day", async () => {
    const { app, container } = createTestContext();
    const calls = [];
    container.useCases.learningSessionCommands.recordAttempt = async (userId, sessionId, input) => {
      calls.push({ userId: String(userId), sessionId, input });
      return {
        session: { id: sessionId },
        daily: {
          day: input.day,
          attempts: 8,
          correct: input.correct ? 6 : 5,
          wrong: input.correct ? 2 : 3,
          newAdded: 10,
          sessions: 1,
          durationSeconds: 120,
        }
      };
    };
    const learner = request.agent(app);
    const registration = await learner
      .post("/api/auth/register")
      .send({ email: "sentence-daily@example.com", password: "password123" })
      .expect(201);

    const response = await learner
      .post("/api/learning/sessions/session-123/attempts")
      .send({ day: "2026-09-03", correct: false })
      .expect(200);

    assert.equal(response.body.daily.attempts, 8);
    assert.deepEqual(calls, [{
      userId: String(registration.body.user.id),
      sessionId: "session-123",
      input: { day: "2026-09-03", correct: false }
    }]);
  });
});
