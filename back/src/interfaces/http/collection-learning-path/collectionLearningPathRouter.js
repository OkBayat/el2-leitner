import { Router } from "express";

import { ValidationError } from "../../../domain/errors.js";
import {
  collectionId,
  exerciseId,
  learningPathId,
  lessonId,
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

  router.get("/collections/:collectionId", async (req, res) => {
    const result = await queries.getCollectionLearningPath.execute(
      req.auth.userId,
      collectionId(req.params.collectionId),
    );
    res.status(200).json(collectionLearningPathDto(result));
  });

  router.get("/:pathId/lessons/:lessonId", async (req, res) => {
    const result = await queries.getLearningPathLesson.execute(
      req.auth.userId,
      learningPathId(req.params.pathId),
      lessonId(req.params.lessonId),
    );
    res.status(200).json({ lesson: lessonDto(result) });
  });

  router.get("/:pathId/lessons/:lessonId/exercises/:exerciseId", async (req, res) => {
    const result = await queries.getExerciseContext.execute(
      req.auth.userId,
      learningPathId(req.params.pathId),
      lessonId(req.params.lessonId),
      exerciseId(req.params.exerciseId),
    );
    res.status(200).json({ context: exerciseContextDto(result) });
  });

  router.get("/:pathId/resume", async (req, res) => {
    const result = await queries.getLearningPathResumePoint.execute(
      req.auth.userId,
      learningPathId(req.params.pathId),
    );
    res.status(200).json(result);
  });

  router.post("/:pathId/start", async (req, res) => {
    const result = await commands.startLearningPath.execute(
      req.auth.userId,
      learningPathId(req.params.pathId),
    );
    res.status(200).json(result);
  });

  router.post("/:pathId/lessons/:lessonId/exercises/:exerciseId/start", async (req, res) => {
    const result = await commands.startExercise.execute(
      req.auth.userId,
      learningPathId(req.params.pathId),
      lessonId(req.params.lessonId),
      exerciseId(req.params.exerciseId),
    );
    res.status(200).json(result);
  });

  router.post("/:pathId/lessons/:lessonId/exercises/:exerciseId/complete", async (req, res) => {
    const result = await commands.completeExercise.execute(
      req.auth.userId,
      learningPathId(req.params.pathId),
      lessonId(req.params.lessonId),
      exerciseId(req.params.exerciseId),
      completionOutcome(req.body?.outcome),
    );
    res.status(200).json(result);
  });

  return router;
}
