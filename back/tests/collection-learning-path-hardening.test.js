import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { StartExercise } from "../src/application/collection-learning-path/commands/StartExercise.js";
import {
  findLearningPathResumePoint,
  projectLearningPathProgress,
} from "../src/domain/collection-learning-path/LearningPathProgression.js";

const NOW = "2026-09-07T08:30:00.000Z";

function exercise(id, position, { required = true, status = "published", retiredAt = null } = {}) {
  return {
    id,
    position,
    type: "fixture.exercise",
    schemaVersion: 1,
    required,
    completionPolicy: "explicit",
    config: {},
    status,
    introducedVersion: 1,
    retiredVersion: retiredAt ? 2 : null,
    publishedAt: NOW,
    retiredAt,
  };
}

function lesson(id, position, exercises, { status = "published", retiredAt = null } = {}) {
  return {
    id,
    title: `Lesson ${position}`,
    position,
    sourceKind: "collection-section",
    sourceRef: `section-${position}`,
    status,
    introducedVersion: 1,
    retiredVersion: retiredAt ? 2 : null,
    publishedAt: NOW,
    retiredAt,
    exercises,
  };
}

function pathDefinition(lessons) {
  return {
    id: "cambridge-vocabulary-for-ielts-learning-path",
    collectionId: "cambridge-vocabulary-for-ielts",
    title: "Cambridge Vocabulary for IELTS",
    mode: "finite",
    status: "published",
    contentVersion: 2,
    sourceHash: null,
    publishedAt: NOW,
    retiredAt: null,
    lessons,
  };
}

class DefinitionReaderFake {
  constructor(path) { this.path = path; }
  async findByPublicId(id) { return id === this.path.id ? structuredClone(this.path) : null; }
}

class AccessReaderFake {
  async getForCollection() { return { canRead: true, canProgress: true }; }
}

class RevisionProgressStoreFake {
  constructor() {
    this.pathId = "cambridge-vocabulary-for-ielts-learning-path";
    this.revision = 0;
    this.pathWrites = 0;
    this.progress = { path: null, lessons: [], exercises: [] };
  }

  async findForPath() { return structuredClone(this.progress); }

  async upsertPathProgress(progress) {
    this.pathWrites += 1;
    if (progress.expectedRevision != null && progress.expectedRevision !== this.revision) {
      return { changed: false, conflict: true, revision: this.revision };
    }
    if (progress.expectedRevision != null) this.revision += 1;
    this.progress.path = {
      status: progress.status,
      startedAt: this.progress.path?.startedAt ?? progress.startedAt,
      completedAt: progress.completedAt ?? null,
      lastActivityAt: progress.lastActivityAt,
      lastSeenContentVersion: progress.lastSeenContentVersion,
      revision: this.revision,
    };
    return { changed: true, conflict: false, revision: this.revision };
  }

  async upsertLessonProgress(progress) {
    const index = this.progress.lessons.findIndex((item) => item.lessonId === progress.lessonId);
    const next = { ...progress };
    delete next.userId;
    if (index >= 0) this.progress.lessons[index] = next;
    else this.progress.lessons.push(next);
    return { changed: true };
  }

  async upsertExerciseProgress(progress) {
    const index = this.progress.exercises.findIndex((item) => item.exerciseId === progress.exerciseId);
    const next = { ...progress };
    delete next.userId;
    if (index >= 0) this.progress.exercises[index] = next;
    else this.progress.exercises.push(next);
    return { changed: true };
  }
}

function startExerciseHarness() {
  const path = pathDefinition([
    lesson("unit-1", 1, [
      exercise("optional-warmup", 1, { required: false }),
      exercise("vocabulary-intake", 2),
    ]),
  ]);
  const store = new RevisionProgressStoreFake();
  const command = new StartExercise({
    definitionReader: new DefinitionReaderFake(path),
    progressReader: store,
    progressWriter: store,
    accessReader: new AccessReaderFake(),
    transactionManager: { execute: (work) => work({}) },
    clock: () => new Date(NOW),
  });
  return { command, store };
}

describe("Collection Learning Path hardening", () => {
  it("makes repeated start requests idempotent even when the retry carries the original revision", async () => {
    const { command, store } = startExerciseHarness();

    const first = await command.execute("user-1", store.pathId, "unit-1", "optional-warmup", 0);
    const retry = await command.execute("user-1", store.pathId, "unit-1", "optional-warmup", 0);

    assert.equal(first.exerciseStatus, "in_progress");
    assert.equal(retry.exerciseStatus, "in_progress");
    assert.equal(first.progressRevision, 1);
    assert.equal(retry.progressRevision, 1);
    assert.equal(store.pathWrites, 1);
  });

  it("rejects a stale concurrent-tab mutation instead of overwriting newer progress", async () => {
    const { command, store } = startExerciseHarness();
    await command.execute("user-1", store.pathId, "unit-1", "optional-warmup", 0);

    await assert.rejects(
      command.execute("user-1", store.pathId, "unit-1", "vocabulary-intake", 0),
      (error) => error?.code === "LEARNING_PATH_PROGRESS_STALE" && error?.statusCode === 409,
    );
    assert.equal(store.progress.exercises.some((item) => item.exerciseId === "vocabulary-intake"), false);
  });

  it("keeps completed Cambridge history while retired content is skipped and newly published content becomes resumable", () => {
    const path = pathDefinition([
      lesson("unit-1", 1, [exercise("unit-1-intake", 1)]),
      lesson("retired-unit", 2, [exercise("retired-exercise", 1)], { retiredAt: NOW }),
      lesson("unit-2", 3, [exercise("unit-2-intake", 1)]),
    ]);
    const projected = projectLearningPathProgress(path, {
      path: {
        status: "completed",
        startedAt: NOW,
        completedAt: NOW,
        lastActivityAt: NOW,
        lastSeenContentVersion: 1,
        revision: 7,
      },
      lessons: [{ lessonId: "unit-1", status: "completed", startedAt: NOW, completedAt: NOW, lastActivityAt: NOW }],
      exercises: [{ exerciseId: "unit-1-intake", status: "completed", startedAt: NOW, completedAt: NOW, lastActivityAt: NOW }],
    });

    assert.deepEqual(projected.lessons.map((item) => item.id), ["unit-1", "unit-2"]);
    assert.equal(projected.lessons[0].state, "completed");
    assert.equal(projected.path.learnerStatus, "in_progress");
    assert.deepEqual(findLearningPathResumePoint(projected), { lessonId: "unit-2", exerciseId: "unit-2-intake" });
  });

  it("projects a 350-lesson path without changing deterministic ordering or resume semantics", () => {
    const lessons = Array.from({ length: 350 }, (_, index) => lesson(
      `unit-${String(index + 1).padStart(3, "0")}`,
      index + 1,
      [exercise(`exercise-${index + 1}`, 1)],
    ));
    const projected = projectLearningPathProgress(pathDefinition(lessons));

    assert.equal(projected.lessons.length, 350);
    assert.equal(projected.lessons[0].state, "available");
    assert.equal(projected.lessons[349].state, "locked");
    assert.deepEqual(findLearningPathResumePoint(projected), { lessonId: "unit-001", exerciseId: "exercise-1" });
  });
});
