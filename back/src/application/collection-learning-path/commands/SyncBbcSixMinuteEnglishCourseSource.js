import { createHash } from "node:crypto";

import {
  buildBbcSixMinuteEnglishCourseSource,
  isBbcSixMinuteEnglishManagedExercise,
} from "../../../domain/collection-learning-path/BbcSixMinuteEnglishCourse.js";

function sameConfig(left, right) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

function active(item) {
  return item && item.status === "published" && item.retiredAt == null;
}

function pathMatches(existing, desired) {
  return Boolean(existing)
    && existing.collectionId === desired.collectionId
    && existing.title === desired.title
    && existing.mode === desired.mode
    && active(existing);
}

function lessonMatches(existing, desired) {
  return Boolean(existing)
    && existing.title === desired.title
    && Number(existing.position) === Number(desired.position)
    && existing.sourceKind === desired.sourceKind
    && existing.sourceRef === desired.sourceRef
    && active(existing);
}

function exerciseMatches(existing, desired) {
  return Boolean(existing)
    && Number(existing.position) === Number(desired.position)
    && existing.type === desired.type
    && Number(existing.schemaVersion) === Number(desired.schemaVersion)
    && Boolean(existing.required) === Boolean(desired.required)
    && existing.completionPolicy === desired.completionPolicy
    && sameConfig(existing.config, desired.config)
    && active(existing);
}

function hashFingerprint(fingerprint) {
  return createHash("sha256").update(JSON.stringify(fingerprint), "utf8").digest("hex");
}

function publishedAt(value, fallback) {
  if (value == null || value === "") return fallback;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function indexCurrent(current) {
  const lessons = new Map((current?.lessons ?? []).map((lesson) => [String(lesson.id), lesson]));
  return { lessons };
}

function buildPlan(source, current) {
  const currentIndex = indexCurrent(current);
  const episodePlans = [];
  let changed = !pathMatches(current, source.path);

  for (const episode of source.episodes) {
    const existingLesson = currentIndex.lessons.get(episode.sourceRef) ?? null;
    if (episode.action === "retire") {
      const shouldRetire = active(existingLesson);
      changed = changed || shouldRetire;
      episodePlans.push({ action: "retire", existingLesson, shouldRetire });
      continue;
    }

    const desiredLesson = episode.lesson;
    const existingExercises = new Map((existingLesson?.exercises ?? []).map((exercise) => [String(exercise.id), exercise]));
    const desiredExerciseIds = new Set(desiredLesson.exercises.map((exercise) => String(exercise.id)));
    const lessonChanged = !lessonMatches(existingLesson, desiredLesson);
    const exercisePlans = desiredLesson.exercises.map((exercise) => ({
      desired: exercise,
      existing: existingExercises.get(String(exercise.id)) ?? null,
    }));
    const staleManagedExercises = (existingLesson?.exercises ?? []).filter(
      (exercise) => active(exercise)
        && isBbcSixMinuteEnglishManagedExercise(exercise)
        && !desiredExerciseIds.has(String(exercise.id)),
    );
    const exerciseChanged = exercisePlans.some(({ desired, existing }) => !exerciseMatches(existing, desired));
    changed = changed || lessonChanged || exerciseChanged || staleManagedExercises.length > 0;
    episodePlans.push({
      action: "publish",
      desiredLesson,
      existingLesson,
      lessonChanged,
      exercisePlans,
      staleManagedExercises,
    });
  }

  return { changed, episodePlans };
}

export class SyncBbcSixMinuteEnglishCourseSource {
  constructor({
    courseCatalogWriter,
    definitionReader,
    definitionWriter,
    transactionManager,
    now = () => new Date(),
  }) {
    this.courseCatalogWriter = courseCatalogWriter;
    this.definitionReader = definitionReader;
    this.definitionWriter = definitionWriter;
    this.transactionManager = transactionManager;
    this.now = now;
  }

  async execute(listeningSources) {
    const source = buildBbcSixMinuteEnglishCourseSource(listeningSources);
    if (source.sourceCount === 0) {
      return {
        changed: false,
        skipped: true,
        sourceCount: 0,
        contentVersion: null,
        lessonWrites: 0,
        exerciseWrites: 0,
        retiredLessons: 0,
        retiredExercises: 0,
      };
    }

    return this.transactionManager.execute(async (connection) => {
      const options = { connection };
      const courseResult = await this.courseCatalogWriter.ensureCourse(source.course, options);
      const current = await this.definitionReader.findByPublicId(source.path.id, {
        includeRetired: true,
        connection,
      });
      const plan = buildPlan(source, current);
      if (!plan.changed) {
        return {
          changed: Boolean(courseResult?.changed),
          skipped: false,
          sourceCount: source.sourceCount,
          contentVersion: current?.contentVersion ?? 0,
          lessonWrites: 0,
          exerciseWrites: 0,
          retiredLessons: 0,
          retiredExercises: 0,
        };
      }

      const at = this.now();
      const contentVersion = current ? Number(current.contentVersion) + 1 : 1;
      const sourceHash = hashFingerprint(source.fingerprint);
      await this.definitionWriter.upsertPath({
        ...source.path,
        contentVersion,
        sourceHash,
        publishedAt: current?.publishedAt ?? at,
        retiredAt: null,
      }, options);

      let lessonWrites = 0;
      let exerciseWrites = 0;
      let retiredLessons = 0;
      let retiredExercises = 0;

      for (const episodePlan of plan.episodePlans) {
        if (episodePlan.action === "retire") {
          if (!episodePlan.shouldRetire) continue;
          for (const exercise of episodePlan.existingLesson?.exercises ?? []) {
            if (!active(exercise) || !isBbcSixMinuteEnglishManagedExercise(exercise)) continue;
            const retired = await this.definitionWriter.retireExercise(exercise.id, {
              version: contentVersion,
              at,
            }, options);
            if (retired?.changed !== false) retiredExercises += 1;
          }
          const retired = await this.definitionWriter.retireLesson(episodePlan.existingLesson.id, {
            version: contentVersion,
            at,
          }, options);
          if (retired?.changed !== false) retiredLessons += 1;
          continue;
        }

        const existingLesson = episodePlan.existingLesson;
        if (episodePlan.lessonChanged) {
          await this.definitionWriter.upsertLesson(source.path.id, {
            ...episodePlan.desiredLesson,
            exercises: undefined,
            status: "published",
            introducedVersion: existingLesson?.introducedVersion ?? contentVersion,
            retiredVersion: null,
            publishedAt: existingLesson?.publishedAt
              ?? publishedAt(episodePlan.desiredLesson.sourcePublishedAt, at),
            retiredAt: null,
          }, options);
          lessonWrites += 1;
        }

        for (const exercisePlan of episodePlan.exercisePlans) {
          if (exerciseMatches(exercisePlan.existing, exercisePlan.desired)) continue;
          await this.definitionWriter.upsertExercise(episodePlan.desiredLesson.id, {
            ...exercisePlan.desired,
            status: "published",
            introducedVersion: exercisePlan.existing?.introducedVersion ?? contentVersion,
            retiredVersion: null,
            publishedAt: exercisePlan.existing?.publishedAt
              ?? publishedAt(episodePlan.desiredLesson.sourcePublishedAt, at),
            retiredAt: null,
          }, options);
          exerciseWrites += 1;
        }

        for (const stale of episodePlan.staleManagedExercises) {
          const retired = await this.definitionWriter.retireExercise(stale.id, {
            version: contentVersion,
            at,
          }, options);
          if (retired?.changed !== false) retiredExercises += 1;
        }
      }

      return {
        changed: true,
        skipped: false,
        sourceCount: source.sourceCount,
        contentVersion,
        lessonWrites,
        exerciseWrites,
        retiredLessons,
        retiredExercises,
      };
    });
  }
}
