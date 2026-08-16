import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GetLearningState } from "../src/application/learning/GetLearningState.js";

class FakeRepository {
  constructor(label) {
    this.label = label;
    this.calls = [];
  }

  async findByUserId(userId) {
    this.calls.push(userId);
    return { state: { label: this.label }, revision: 7 };
  }
}

describe("GetLearningState", () => {
  it("uses the lean repository only for the bootstrap view", async () => {
    const full = new FakeRepository("full");
    const bootstrap = new FakeRepository("bootstrap");
    const useCase = new GetLearningState({
      learningStateRepository: full,
      learningBootstrapRepository: bootstrap
    });

    assert.equal((await useCase.execute(3, { view: "bootstrap" })).state.label, "bootstrap");
    assert.equal((await useCase.execute(3, { view: "full" })).state.label, "full");
    assert.equal((await useCase.execute(3)).state.label, "full");
    assert.deepEqual(bootstrap.calls, [3]);
    assert.deepEqual(full.calls, [3, 3]);
  });
});
