import {
  IELTS_LISTENING_EVIDENCE_TYPE,
  resolveIeltsListeningReference,
} from "../../../domain/collection-learning-path/IeltsListeningExercise.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../../domain/listening-practice/ListeningProviders.js";

function evidenceAttemptId(outcome) {
  const attemptId = String(outcome?.evidence?.attemptId ?? "").trim();
  return attemptId && attemptId.length <= 64 ? attemptId : null;
}

export class VerifyIeltsListeningCompletion {
  constructor({ ieltsListeningReader }) {
    this.ieltsListeningReader = ieltsListeningReader;
  }

  async execute({ userId, exercise, outcome }) {
    const reference = resolveIeltsListeningReference(exercise);
    const attemptId = evidenceAttemptId(outcome);
    if (!attemptId) return false;

    const attempt = await this.ieltsListeningReader.findSubmittedAttempt(userId, attemptId);
    if (!attempt) return false;
    if (String(attempt.id) !== attemptId) return false;
    if (String(attempt.userId) !== String(userId)) return false;
    if (attempt.provider !== BBC_SIX_MINUTE_ENGLISH) return false;
    if (attempt.status !== "completed" || !attempt.submittedAt) return false;
    if (attempt.lessonSlug !== reference.lessonSlug) return false;
    if (attempt.testId !== reference.testId) return false;

    return {
      evidenceType: IELTS_LISTENING_EVIDENCE_TYPE,
      evidenceRef: attemptId,
    };
  }
}
