import { createHash } from "node:crypto";

import {
  FILE_MANAGED_LESSON_SOURCE_KIND,
  isFileManagedLearningPathId,
  materializeLessonSourceScope,
  validateFileManagedLearningPathSourceCatalog,
} from "../../../domain/collection-learning-path/FileManagedLearningPathSource.js";
import { ValidationError } from "../../../domain/errors.js";

function sameConfig(left, right) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

function available(item) {
  return item && item.retiredAt == null;
}

function published(item) {
  return available(item) && item.status === "published";
}

function pathMatches(existing, desired) {
  return Boolean(existing)
    && existing.collectionId === desired.collectionId
    && existing.title === desired.title
    && existing.mode === desired.mode
    && existing.status === desired.status
    && available(existing);
}

function lessonMatches(existing, desired) {
  return Boolean(existing)
    && existing.title === desired.title
    && Number(existing.position) === Number(desired.position)
    && existing.sourceKind === desired.sourceKind
    && existing.sourceRef === desired.sourceRef
    && published(existing);
}

function exerciseMatches(existing, desired) {
  return Boolean(existing)
    && Number(existing.position) === Number(desired.position)
    && existing.type === desired.type
    && Number(existing.schemaVersion) === Number(desired.schemaVersion)
    && Boolean(existing.required) === Boolean(desired.required)
    && existing.completionPolicy === desired.completionPolicy
    && sameConfig(existing.config, desired.config)
    && published(existing);
}

function hashFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function referenceError(message) {
  throw new ValidationError("FILE_MANAGED_LEARNING_PATH_REFERENCE_NOT_FOUND", message);
}

async function materializeDefinition(definition, sourceReferenceReader, options) {
  const collection = await sourceReferenceReader.resolveCollection(definition.path.collectionId, options);
  if (!collection) {
    referenceError(`Learning Path collection ${definition.path.collectionId} was not found or is not published.`);
  }

  const lessons = [];
  for (const lesson of definition.lessons) {
    const resolved = await sourceReferenceReader.findCollectionSection({
      collectionId: collection.id,
      sectionTitle: lesson.source.sectionTitle,
    }, options);
    if (!resolved) {
      referenceError(
        `Learning Path collection section ${definition.path.collectionId} / ${lesson.source.sectionTitle} was not found.`,
      );
    }
    const runtimeSource = { kind: FILE_MANAGED_LESSON_SOURCE_KIND, ref: String(resolved.id) };
    lessons.push({
      id: lesson.id,
      title: lesson.title,
      position: lesson.position,
      sourceKind: runtimeSource.kind,
      sourceRef: runtimeSource.ref,
      exercises: lesson.exercises.map((exercise) => ({
        ...exercise,
        config: materializeLessonSourceScope(exercise.config, runtimeSource),
      })),
    });
  }

  return {
    path: { ...definition.path, collectionId: collection.id },
    managedIdPrefix: definition.managedIdPrefix,
    lessons,
  };
}

function buildPlan(desired, current) {
  const currentLessons = new Map((current?.lessons ?? []).map((lesson) => [String(lesson.id), lesson]));
  const desiredLessonIds = new Set(desired.lessons.map((lesson) => String(lesson.id)));
  const lessonPlans = [];
  let changed = !pathMatches(current, desired.path);

  for (const desiredLesson of desired.lessons) {
    const existingLesson = currentLessons.get(String(desiredLesson.id)) ?? null;
    const existingExercises = new Map((existingLesson?.exercises ?? []).map((exercise) => [String(exercise.id), exercise]));
    const desiredExerciseIds = new Set(desiredLesson.exercises.map((exercise) => String(exercise.id)));
    const exercisePlans = desiredLesson.exercises.map((exercise) => ({
      desired: exercise,
      existing: existingExercises.get(String(exercise.id)) ?? null,
    }));
    const staleExercises = (existingLesson?.exercises ?? []).filter(
      (exercise) => published(exercise)
        && isFileManagedLearningPathId(exercise.id, desired.managedIdPrefix)
        && !desiredExerciseIds.has(String(exercise.id)),
    );
    const lessonChanged = !lessonMatches(existingLesson, desiredLesson);
    const exercisesChanged = exercisePlans.some(({ desired: exercise, existing }) => !exerciseMatches(existing, exercise));
    changed = changed || lessonChanged || exercisesChanged || staleExercises.length > 0;
    lessonPlans.push({
      desired: desiredLesson,
      existing: existingLesson,
      lessonChanged,
      exercisePlans,
      staleExercises,
    });
  }

  const staleLessons = (current?.lessons ?? []).filter(
    (lesson) => published(lesson)
      && isFileManagedLearningPathId(lesson.id, desired.managedIdPrefix)
      && !desiredLessonIds.has(String(lesson.id)),
  );
  if (staleLessons.length > 0) changed = true;
  return { changed, lessonPlans, staleLessons };
}

function fingerprint(desired) {
  return {
    path: desired.path,
    managedIdPrefix: desired.managedIdPrefix,
    lessons: desired.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      position: lesson.position,
      sourceKind: lesson.sourceKind,
      sourceRef: lesson.sourceRef,
      exercises: lesson.exercises,
    })),
  };
}

export class SyncFileManagedLearningPathSources {
  constructor({ definitionReader, definitionWriter, sourceReferenceReader, transactionManager, now = () => new Date() }) {
    this.definitionReader = definitionReader;
    this.definitionWriter = definitionWriter;
    this.sourceReferenceReader = sourceReferenceReader;
    this.transactionManager = transactionManager;
    this.now = now;
  }

  async execute(sources) {
    const sourceList = Array.isArray(sources) ? sources : [];
    validateFileManagedLearningPathSourceCatalog(sourceList.map((source) => source.definition));
    const results = [];
    for (const source of sourceList) {
      results.push(await this.#syncOne(source));
    }
    return {
      changed: results.some((result) => result.changed),
      sourceCount: sourceList.length,
      sourcesChanged: results.filter((result) => result.changed).length,
      results,
    };
  }

  async #syncOne(source) {
    return this.transactionManager.execute(async (connection) => {
      const options = { connection };
      const desired = await materializeDefinition(source.definition, this.sourceReferenceReader, options);
      const current = await this.definitionReader.findByPublicId(desired.path.id, {
        includeRetired: true,
        connection,
      });
      const plan = buildPlan(desired, current);
      if (!plan.changed) {
        return {
          fileName: source.fileName,
          pathId: desired.path.id,
          changed: false,
          contentVersion: current?.contentVersion ?? 0,
          lessonWrites: 0,
          exerciseWrites: 0,
          retiredLessons: 0,
          retiredExercises: 0,
        };
      }

      const at = this.now();
      const contentVersion = current ? Number(current.contentVersion) + 1 : 1;
      await this.definitionWriter.upsertPath({
        ...desired.path,
        contentVersion,
        sourceHash: hashFingerprint(fingerprint(desired)),
        publishedAt: current?.publishedAt ?? (desired.path.status === "published" ? at : null),
        retiredAt: null,
      }, options);

      let lessonWrites = 0;
      let exerciseWrites = 0;
      let retiredLessons = 0;
      let retiredExercises = 0;

      for (const lessonPlan of plan.lessonPlans) {
        if (lessonPlan.lessonChanged) {
          await this.definitionWriter.upsertLesson(desired.path.id, {
            ...lessonPlan.desired,
            exercises: undefined,
            status: "published",
            introducedVersion: lessonPlan.existing?.introducedVersion ?? contentVersion,
            retiredVersion: null,
            publishedAt: lessonPlan.existing?.publishedAt ?? at,
            retiredAt: null,
          }, options);
          lessonWrites += 1;
        }
        for (const exercisePlan of lessonPlan.exercisePlans) {
          if (exerciseMatches(exercisePlan.existing, exercisePlan.desired)) continue;
          await this.definitionWriter.upsertExercise(lessonPlan.desired.id, {
            ...exercisePlan.desired,
            status: "published",
            introducedVersion: exercisePlan.existing?.introducedVersion ?? contentVersion,
            retiredVersion: null,
            publishedAt: exercisePlan.existing?.publishedAt ?? at,
            retiredAt: null,
          }, options);
          exerciseWrites += 1;
        }
        for (const staleExercise of lessonPlan.staleExercises) {
          const result = await this.definitionWriter.retireExercise(staleExercise.id, {
            version: contentVersion,
            at,
          }, options);
          if (result?.changed !== false) retiredExercises += 1;
        }
      }

      for (const staleLesson of plan.staleLessons) {
        for (const exercise of staleLesson.exercises ?? []) {
          if (!published(exercise) || !isFileManagedLearningPathId(exercise.id, desired.managedIdPrefix)) continue;
          const result = await this.definitionWriter.retireExercise(exercise.id, {
            version: contentVersion,
            at,
          }, options);
          if (result?.changed !== false) retiredExercises += 1;
        }
        const result = await this.definitionWriter.retireLesson(staleLesson.id, {
          version: contentVersion,
          at,
        }, options);
        if (result?.changed !== false) retiredLessons += 1;
      }

      return {
        fileName: source.fileName,
        pathId: desired.path.id,
        changed: true,
        contentVersion,
        lessonWrites,
        exerciseWrites,
        retiredLessons,
        retiredExercises,
      };
    });
  }
}
