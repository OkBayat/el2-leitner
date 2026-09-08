export const VOCABULARY_PROGRESS_STATE = Object.freeze({
  NEW: "new",
  LEARNING: "learning",
  MASTERED: "mastered",
  EXCLUDED: "excluded",
});

export function classifyVocabularyProgress(progress) {
  if (!progress) return VOCABULARY_PROGRESS_STATE.NEW;
  if (progress.status === "excluded") return VOCABULARY_PROGRESS_STATE.EXCLUDED;
  if (progress.status === "mastered" || progress.masteredAt != null) {
    return VOCABULARY_PROGRESS_STATE.MASTERED;
  }
  if (Number(progress.box ?? 0) > 0 || progress.introducedOn != null) {
    return VOCABULARY_PROGRESS_STATE.LEARNING;
  }
  return VOCABULARY_PROGRESS_STATE.NEW;
}

export function isNewVocabularyProgress(progress) {
  return classifyVocabularyProgress(progress) === VOCABULARY_PROGRESS_STATE.NEW;
}
