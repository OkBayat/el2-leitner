import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetLeitnerHouse } from "../src/application/learning/GetLeitnerHouse.js";

class FakeLearningStateRepository {
  constructor(state) {
    this.state = state;
    this.calls = [];
  }

  async findByUserId(userId) {
    this.calls.push(userId);
    return { state: structuredClone(this.state), revision: 3 };
  }
}

describe("GetLeitnerHouse", () => {
  it("returns only active words in the requested house with aggregate information", async () => {
    const repository = new FakeLearningStateRepository({
      words: [
        {
          id: "box-2-hard",
          number: 4,
          term: "consequence",
          accepted: ["consequence"],
          category: "General",
          tags: ["ielts"],
          lessons: ["Unit 3"],
          box: 2,
          due: "2026-09-01",
          attempts: 8,
          correct: 3,
          mistakes: 5,
          lastReviewed: "2026-08-31T08:00:00.000Z"
        },
        {
          id: "box-2-future",
          number: 7,
          term: "spacious",
          accepted: ["spacious"],
          category: "Home",
          tags: [],
          lessons: [],
          box: 2,
          due: "2026-09-03",
          attempts: 2,
          correct: 2,
          mistakes: 0,
          lastReviewed: null
        },
        { id: "box-1", term: "patient", box: 1, mistakes: 9 },
        {
          id: "mastered-box-5",
          term: "finished",
          box: 5,
          masteredAt: "2026-08-30T10:00:00.000Z",
          mistakes: 1
        }
      ]
    });
    const query = new GetLeitnerHouse({
      learningStateRepository: repository,
      today: () => "2026-09-01"
    });

    const result = await query.execute("user-7", 2);

    assert.deepEqual(repository.calls, ["user-7"]);
    assert.deepEqual(result.house, {
      number: 2,
      reviewIntervalDays: 2,
      stateCount: 2
    });
    assert.deepEqual(result.summary, {
      totalWords: 2,
      dueWords: 1,
      totalAttempts: 10,
      totalMistakes: 5
    });
    assert.deepEqual(result.words.map((word) => word.id), ["box-2-hard", "box-2-future"]);
    assert.deepEqual(result.words[0], {
      id: "box-2-hard",
      number: 4,
      term: "consequence",
      accepted: ["consequence"],
      category: "General",
      tags: ["ielts"],
      lessons: ["Unit 3"],
      due: "2026-09-01",
      attempts: 8,
      correct: 3,
      mistakes: 5,
      lastReviewed: "2026-08-31T08:00:00.000Z"
    });
  });

  it("excludes mastered house-five words so the detail count matches the dashboard", async () => {
    const repository = new FakeLearningStateRepository({
      words: [
        { id: "active", term: "active", box: 5, due: "2026-09-10", mistakes: 0 },
        { id: "mastered", term: "mastered", box: 5, due: null, masteredAt: "2026-08-31T00:00:00.000Z" }
      ]
    });
    const query = new GetLeitnerHouse({ learningStateRepository: repository });

    const result = await query.execute("user-1", "5");

    assert.deepEqual(result.words.map((word) => word.id), ["active"]);
    assert.equal(result.summary.totalWords, 1);
  });

  it("rejects house numbers outside the Leitner aggregate", async () => {
    const query = new GetLeitnerHouse({
      learningStateRepository: new FakeLearningStateRepository({ words: [] })
    });

    await assert.rejects(
      query.execute("user-1", 0),
      (error) => error.code === "INVALID_LEITNER_HOUSE" && error.statusCode === 400
    );
    await assert.rejects(
      query.execute("user-1", 6),
      (error) => error.code === "INVALID_LEITNER_HOUSE" && error.statusCode === 400
    );
  });

  it("returns an empty read model when the learner has no persisted state yet", async () => {
    const repository = {
      async findByUserId() {
        return { state: null, revision: 0 };
      }
    };
    const query = new GetLeitnerHouse({ learningStateRepository: repository });

    const result = await query.execute("new-user", 1);

    assert.equal(result.summary.totalWords, 0);
    assert.deepEqual(result.words, []);
  });
});
