import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors.js";
import { gradeListeningAttempt } from "../../domain/listening-practice/ListeningGrader.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../domain/listening-practice/ListeningProviders.js";

function attemptId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 64) {
    throw new ValidationError("INVALID_LISTENING_ATTEMPT", "A valid listening attempt id is required.");
  }
  return id;
}

export class SubmitListeningAttempt {
  constructor({ listeningPracticeRepository }) {
    this.listeningPracticeRepository = listeningPracticeRepository;
  }

  async execute(userId, rawAttemptId, input = {}) {
    const state = await this.listeningPracticeRepository.getAttemptForGrading(userId, attemptId(rawAttemptId));
    if (state.completedResult) return state.completedResult;
    if (!state.lesson || state.lesson.provider !== BBC_SIX_MINUTE_ENGLISH) {
      throw new NotFoundError("LISTENING_ATTEMPT_NOT_FOUND", "Listening attempt was not found.");
    }
    if (state.attempt.lessonContentVersion !== state.lesson.contentVersion) {
      throw new ConflictError(
        "LISTENING_LESSON_UPDATED",
        "This lesson changed after the attempt started. Start the lesson again."
      );
    }
    const grade = gradeListeningAttempt(state.lesson, input.answers);
    return this.listeningPracticeRepository.completeAttempt(userId, state.attempt.id, grade);
  }
}
