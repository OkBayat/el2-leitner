import {
  VOCABULARY_INTAKE_COMPLETION_POLICY,
  vocabularyIntakeEvidenceRef,
  vocabularyIntakeReadyForCompletion,
} from "../../../domain/collection-learning-path/VocabularyIntake.js";
import { loadVocabularyIntakePayload } from "../vocabularyIntakeSupport.js";

export class VerifyVocabularyIntakeCompletion {
  constructor({ vocabularyIntakeReader }) {
    this.vocabularyIntakeReader = vocabularyIntakeReader;
  }

  async execute({ userId, exercise }) {
    const payload = await loadVocabularyIntakePayload(this.vocabularyIntakeReader, userId, exercise);
    if (!vocabularyIntakeReadyForCompletion(payload)) return false;
    return {
      evidenceType: VOCABULARY_INTAKE_COMPLETION_POLICY,
      evidenceRef: vocabularyIntakeEvidenceRef(payload.scope),
    };
  }
}
