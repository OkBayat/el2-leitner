import {
  resolveSlideSequenceDefinition,
  verifySlideSequenceCompletion,
} from "../../../domain/collection-learning-path/SlideSequenceExercise.js";

export class VerifySlideSequenceCompletion {
  constructor({ vocabularyReader, recordingArtifactRepository }) {
    this.vocabularyReader = vocabularyReader;
    this.recordingArtifactRepository = recordingArtifactRepository;
  }

  async execute({ userId, exercise, outcome }) {
    const definition = resolveSlideSequenceDefinition(exercise);
    const scoped = definition.scope
      ? await this.vocabularyReader.findForScope(userId, definition.scope)
      : null;
    const rawResults = outcome?.evidence?.results;
    if (!Array.isArray(rawResults) || rawResults.length > 1000) return false;
    const artifactIds = rawResults
      .filter((result) => result?.slideType === "speaking-response")
      .map((result) => String(result?.data?.recordingArtifactId ?? "").trim())
      .filter(Boolean);
    if (artifactIds.some((id) => id.length > 64)) return false;
    const artifacts = artifactIds.length > 0
      ? await this.recordingArtifactRepository.findByPublicIds(userId, artifactIds)
      : [];
    return verifySlideSequenceCompletion(exercise, outcome, scoped?.items ?? [], {
      userId,
      exerciseId: exercise.id,
      exerciseStartedAt: exercise.progress?.startedAt,
      recordingArtifacts: new Map(artifacts.map((artifact) => [artifact.publicId, artifact])),
    });
  }
}
