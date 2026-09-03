import { ValidationError } from "../../domain/errors.js";

function count(value, name) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new ValidationError("INVALID_SESSION", `${name} must be a non-negative integer.`);
  }
  return number;
}

function localDay(value) {
  const day = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) {
    throw new ValidationError("INVALID_SESSION", "day must use YYYY-MM-DD format.");
  }
  return day;
}

export class LearningSessionCommands {
  constructor({ practiceSessionRepository }) {
    this.practiceSessionRepository = practiceSessionRepository;
  }

  async start(userId, input = {}) {
    const mode = String(input.mode || "review").slice(0, 64);
    const plannedCount = input.plannedCount === null || input.plannedCount === undefined
      ? null
      : count(input.plannedCount, "plannedCount");
    return {
      session: await this.practiceSessionRepository.start(userId, { mode, plannedCount })
    };
  }

  async recordAttempt(userId, sessionId, input = {}) {
    if (typeof input.correct !== "boolean") {
      throw new ValidationError("INVALID_SESSION", "correct must be a boolean.");
    }
    return this.practiceSessionRepository.recordAttempt(userId, sessionId, {
      day: localDay(input.day),
      correct: input.correct
    });
  }

  async complete(userId, sessionId, input = {}) {
    const completedCount = count(input.completedCount, "completedCount");
    const correctCount = count(input.correctCount, "correctCount");
    const wrongCount = count(input.wrongCount, "wrongCount");
    const durationSeconds = count(input.durationSeconds, "durationSeconds");
    if (correctCount + wrongCount !== completedCount) {
      throw new ValidationError("INVALID_SESSION", "correctCount and wrongCount must equal completedCount.");
    }
    return {
      session: await this.practiceSessionRepository.complete(userId, sessionId, {
        completedCount,
        correctCount,
        wrongCount,
        durationSeconds
      })
    };
  }

  async abandon(userId, sessionId, input = {}) {
    const durationSeconds = count(input.durationSeconds, "durationSeconds");
    return {
      session: await this.practiceSessionRepository.abandon(userId, sessionId, { durationSeconds })
    };
  }
}
