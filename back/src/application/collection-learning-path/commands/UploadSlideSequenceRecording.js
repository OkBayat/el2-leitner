import { ConflictError, ValidationError } from "../../../domain/errors.js";
import { resolveSlideSequenceDefinition, SLIDE_SEQUENCE_TYPE } from "../../../domain/collection-learning-path/SlideSequenceExercise.js";
import { validateSlideSequenceRecording } from "../../../domain/collection-learning-path/SlideSequenceRecording.js";
import {
  ensureLearningPathProgressAccess,
  loadPathById,
  projectedPathForUser,
  requireProjectedExercise,
  requireProjectedLesson,
} from "../learningPathSupport.js";

function slideId(value) {
  const id = String(value ?? "").trim();
  if (!id || id.length > 160) {
    throw new ValidationError("INVALID_SLIDE_SEQUENCE_SLIDE_ID", "A valid speaking slide id is required.");
  }
  return id;
}

export class UploadSlideSequenceRecording {
  constructor({
    definitionReader,
    progressReader,
    accessReader,
    recordingArtifactRepository,
    idFactory,
    hashFactory,
    clock = () => new Date(),
  }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
    this.recordingArtifactRepository = recordingArtifactRepository;
    this.idFactory = idFactory;
    this.hashFactory = hashFactory;
    this.clock = clock;
  }

  async execute(userId, pathId, lessonId, exerciseId, rawSlideId, upload) {
    const path = await loadPathById(this.definitionReader, pathId);
    await ensureLearningPathProgressAccess(this.accessReader, userId, path);
    const current = await projectedPathForUser({ progressReader: this.progressReader, userId, path });
    const lesson = requireProjectedLesson(current.projected, lessonId);
    const exercise = requireProjectedExercise(lesson, exerciseId);
    if (exercise.state === "locked" || exercise.progress?.status !== "in_progress") {
      throw new ConflictError(
        "LEARNING_PATH_EXERCISE_NOT_STARTED",
        "Start the exercise before uploading a speaking recording.",
      );
    }
    if (exercise.type !== SLIDE_SEQUENCE_TYPE) {
      throw new ValidationError(
        "INVALID_SLIDE_SEQUENCE_RECORDING_EXERCISE",
        "Speaking recordings can only be attached to a slide-sequence exercise.",
      );
    }
    const requestedSlideId = slideId(rawSlideId);
    const definition = resolveSlideSequenceDefinition(exercise);
    const slide = definition.slides.find((candidate) => candidate.id === requestedSlideId);
    if (slide?.type !== "speaking-response") {
      throw new ValidationError(
        "INVALID_SLIDE_SEQUENCE_RECORDING_SLIDE",
        "The recording must belong to a configured speaking-response slide.",
      );
    }
    const recording = validateSlideSequenceRecording(upload);
    const artifact = {
      publicId: this.idFactory(),
      userId,
      exerciseId: exercise.id,
      exerciseStartedAt: exercise.progress.startedAt,
      slideId: requestedSlideId,
      ...recording,
      sha256: this.hashFactory(recording.bytes),
      createdAt: this.clock().toISOString(),
    };
    await this.recordingArtifactRepository.save(artifact);
    return { artifactId: artifact.publicId };
  }
}
