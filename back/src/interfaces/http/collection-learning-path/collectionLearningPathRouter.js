import { Router } from "express";

import { ValidationError } from "../../../domain/errors.js";
import {
  collectionId,
  exerciseId,
  learningPathId,
  lessonId,
  routePublicId,
} from "../../../application/collection-learning-path/learningPathSupport.js";
import {
  collectionLearningPathDto,
  exerciseContextDto,
  lessonDto,
} from "./learningPathDtos.js";

function completionOutcome(value) {
  if (!value || value.kind !== "completed") {
    throw new ValidationError(
      "INVALID_LEARNING_PATH_OUTCOME",
      "Only a completed exercise outcome can be submitted.",
    );
  }
  return value;
}

export function createCollectionLearningPathRouter({ queries, commands, authenticate }) {
  const router = Router();

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(authenticate);

  router.get("/collections", async (req, res) => {
    const learningPaths = await queries.listAvailableCollections.execute(req.auth.userId);
    res.status(200).json({
      collectionIds: learningPaths.map((item) => item.collectionId),
      learningPaths,
    });
  });

  router.get("/collections/:collectionId", async (req, res) => {
    const result = await queries.getCollectionLearningPath.execute(
      req.auth.userId,
      collectionId(req.params.collectionId),
    );
    res.status(200).json(collectionLearningPathDto(result));
  });

  router.get("/legacy/:pathId/lessons/:lessonId/exercises/:exerciseId/route", async (req, res) => {
    const result = await queries.resolveLegacyLearningPathRoute.execute(
      req.auth.userId,
      learningPathId(req.params.pathId),
      lessonId(req.params.lessonId),
      exerciseId(req.params.exerciseId),
    );
    res.status(200).json(result);
  });

  router.get("/:pathId", async (req, res) => {
    const result = await queries.getLearningPath.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
    );
    res.status(200).json(collectionLearningPathDto(result));
  });

  router.get("/:pathId/lessons/:lessonId", async (req, res) => {
    const result = await queries.getLearningPathLesson.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
      routePublicId(req.params.lessonId, "LEARNING_PATH_LESSON", "Learning Path lesson"),
    );
    res.status(200).json({ lesson: lessonDto(result) });
  });

  router.get("/:pathId/lessons/:lessonId/exercises/:exerciseId", async (req, res) => {
    const result = await queries.getExerciseContext.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
      routePublicId(req.params.lessonId, "LEARNING_PATH_LESSON", "Learning Path lesson"),
      routePublicId(req.params.exerciseId, "LEARNING_PATH_EXERCISE", "Learning Path exercise"),
    );
    res.status(200).json({ context: exerciseContextDto(result) });
  });

  router.get("/:pathId/resume", async (req, res) => {
    const result = await queries.getLearningPathResumePoint.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
    );
    res.status(200).json(result);
  });

  router.post("/:pathId/start", async (req, res) => {
    const result = await commands.startLearningPath.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
    );
    res.status(200).json(result);
  });

  router.post("/:pathId/lessons/:lessonId/exercises/:exerciseId/start", async (req, res) => {
    const result = await commands.startExercise.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
      routePublicId(req.params.lessonId, "LEARNING_PATH_LESSON", "Learning Path lesson"),
      routePublicId(req.params.exerciseId, "LEARNING_PATH_EXERCISE", "Learning Path exercise"),
      req.body?.progressRevision,
    );
    res.status(200).json(result);
  });

  router.post("/:pathId/lessons/:lessonId/exercises/:exerciseId/vocabulary-intake/activate", async (req, res) => {
    const result = await commands.activateVocabularyIntake.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
      routePublicId(req.params.lessonId, "LEARNING_PATH_LESSON", "Learning Path lesson"),
      routePublicId(req.params.exerciseId, "LEARNING_PATH_EXERCISE", "Learning Path exercise"),
    );
    res.status(200).json(result);
  });

  router.post("/:pathId/lessons/:lessonId/exercises/:exerciseId/vocabulary-mastery-check/start", async (req, res) => {
    const result = await commands.startVocabularyMasteryCheck.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
      routePublicId(req.params.lessonId, "LEARNING_PATH_LESSON", "Learning Path lesson"),
      routePublicId(req.params.exerciseId, "LEARNING_PATH_EXERCISE", "Learning Path exercise"),
    );
    res.status(200).json(result);
  });

  router.post("/:pathId/lessons/:lessonId/exercises/:exerciseId/vocabulary-spelling/start", async (req, res) => {
    const result = await commands.startVocabularySpelling.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
      routePublicId(req.params.lessonId, "LEARNING_PATH_LESSON", "Learning Path lesson"),
      routePublicId(req.params.exerciseId, "LEARNING_PATH_EXERCISE", "Learning Path exercise"),
      req.body?.scope,
    );
    res.status(201).json(result);
  });

  router.post("/:pathId/lessons/:lessonId/exercises/:exerciseId/complete", async (req, res) => {
    const result = await commands.completeExercise.execute(
      req.auth.userId,
      routePublicId(req.params.pathId, "LEARNING_PATH", "Learning Path"),
      routePublicId(req.params.lessonId, "LEARNING_PATH_LESSON", "Learning Path lesson"),
      routePublicId(req.params.exerciseId, "LEARNING_PATH_EXERCISE", "Learning Path exercise"),
      completionOutcome(req.body?.outcome),
      req.body?.progressRevision,
    );
    res.status(200).json(result);
  });

  return router;
}
