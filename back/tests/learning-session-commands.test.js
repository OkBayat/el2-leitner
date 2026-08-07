import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LearningSessionCommands } from "../src/application/learning/LearningSessionCommands.js";

class FakeSessions {
  async start(userId, input) {
    return { id: "session-1", userId, ...input };
  }
  async complete(userId, id, input) {
    return { id, userId, status: "completed", ...input };
  }
  async abandon(userId, id, input) {
    return { id, userId, status: "abandoned", ...input };
  }
}

describe("LearningSessionCommands", () => {
  it("records explicit session boundaries instead of inferring them from review events", async () => {
    const commands = new LearningSessionCommands({ practiceSessionRepository: new FakeSessions() });
    const started = await commands.start("7", { mode: "review", plannedCount: 12 });
    assert.equal(started.session.plannedCount, 12);

    const completed = await commands.complete("7", "session-1", {
      completedCount: 12,
      correctCount: 9,
      wrongCount: 3,
      durationSeconds: 420
    });
    assert.equal(completed.session.status, "completed");
  });

  it("rejects internally inconsistent completion counters", async () => {
    const commands = new LearningSessionCommands({ practiceSessionRepository: new FakeSessions() });
    await assert.rejects(
      commands.complete("7", "session-1", {
        completedCount: 10,
        correctCount: 5,
        wrongCount: 2,
        durationSeconds: 60
      }),
      { code: "INVALID_SESSION" }
    );
  });
});
