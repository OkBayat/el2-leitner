import { ValidationError } from "../../domain/errors.js";

const THEME_MODES = new Set(["system", "light", "dark"]);
const DEFAULT_DAILY_LISTENING_GOAL = 3;
const MAX_DAILY_LISTENING_GOAL = 12;

function integerInRange(value, min, max, code, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new ValidationError(code, `${label} must be an integer between ${min} and ${max}.`);
  }
  return number;
}

export function normalizeLearningSettings(input = {}) {
  const voiceRate = Number(input.voiceRate);
  if (!Number.isFinite(voiceRate) || voiceRate < 0.5 || voiceRate > 1.2) {
    throw new ValidationError(
      "INVALID_VOICE_RATE",
      "Pronunciation speed must be between 0.5 and 1.2."
    );
  }
  if (!THEME_MODES.has(input.theme)) {
    throw new ValidationError(
      "INVALID_THEME",
      "Theme must be one of: system, light, dark."
    );
  }

  return {
    dailyNew: integerInRange(input.dailyNew, 1, 50, "INVALID_DAILY_NEW", "New words per day"),
    dailyGoal: integerInRange(input.dailyGoal, 5, 200, "INVALID_DAILY_GOAL", "Daily answer goal"),
    dailyListeningGoal: integerInRange(
      input.dailyListeningGoal ?? DEFAULT_DAILY_LISTENING_GOAL,
      1,
      MAX_DAILY_LISTENING_GOAL,
      "INVALID_DAILY_LISTENING_GOAL",
      "Listening practices per day"
    ),
    voiceRate,
    theme: input.theme,
  };
}

export class UpdateLearningSettings {
  constructor({ learningSettingsRepository }) {
    this.learningSettingsRepository = learningSettingsRepository;
  }

  async execute(userId, input = {}) {
    const expectedRevision = input.revision;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new ValidationError(
        "INVALID_REVISION",
        "Revision must be a non-negative safe integer."
      );
    }

    const settings = normalizeLearningSettings(input.settings);
    const revision = await this.learningSettingsRepository.update(
      userId,
      settings,
      expectedRevision
    );
    return { settings, revision };
  }
}
