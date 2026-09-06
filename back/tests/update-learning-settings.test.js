import assert from "node:assert/strict";
import test from "node:test";
import {
  UpdateLearningSettings,
  normalizeLearningSettings,
} from "../src/application/learning/UpdateLearningSettings.js";

test("learning settings command persists only the validated settings object and revision", async () => {
  const calls = [];
  const repository = {
    async update(userId, settings, revision) {
      calls.push({ userId, settings, revision });
      return revision + 1;
    },
  };
  const useCase = new UpdateLearningSettings({ learningSettingsRepository: repository });
  const settings = {
    dailyNew: 10,
    dailyGoal: 25,
    dailyListeningGoal: 4,
    voiceRate: 0.9,
    theme: "dark",
  };

  const result = await useCase.execute("user-1", {
    settings,
    revision: 7,
    state: { words: new Array(500).fill({ term: "must-not-be-forwarded" }) },
  });

  assert.deepEqual(calls, [{ userId: "user-1", settings, revision: 7 }]);
  assert.deepEqual(result, { settings, revision: 8 });
});

test("learning settings command validates every supported setting and defaults the listening goal to three", () => {
  assert.deepEqual(normalizeLearningSettings({
    dailyNew: 10,
    dailyGoal: 20,
    voiceRate: 0.85,
    theme: "system",
  }), {
    dailyNew: 10,
    dailyGoal: 20,
    dailyListeningGoal: 3,
    voiceRate: 0.85,
    theme: "system",
  });

  assert.throws(() => normalizeLearningSettings({
    dailyNew: 10,
    dailyGoal: 20,
    dailyListeningGoal: 13,
    voiceRate: 0.85,
    theme: "system",
  }), (error) => error?.code === "INVALID_DAILY_LISTENING_GOAL");
});
