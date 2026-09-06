import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CompleteExercise } from "../src/application/collection-learning-path/commands/CompleteExercise.js";
import { StartExercise } from "../src/application/collection-learning-path/commands/StartExercise.js";
import { ExerciseRuntimeRegistry } from "../src/application/collection-learning-path/ExerciseRuntimeRegistry.js";
import { GetCollectionLearningPath } from "../src/application/collection-learning-path/queries/GetCollectionLearningPath.js";

const NOW = "2026-09-06T20:30:00.000Z";

function exercise(id, position = 1) {
  return {
    id,
    position,
    type: "fixture.exercise",
    schemaVersion: 1,
    required: true,
    completionPolicy: "explicit",
    config: {},
    status: "published",
    introducedVersion: 1,
    retiredVersion: null,
    publishedAt: NOW,
    retiredAt: null,
  };
}

function lesson(id, position, exerciseId) {
  return {
    id,
    title: `Lesson ${position}`,
    position,
    sourceKind: "listening-episode",
    sourceRef: id,
    status: "published",
    introducedVersion: 1,
    retiredVersion: null,
    publishedAt: NOW,
    retiredAt: null,
    exercises: [exercise(exerciseId)],
  };
}

function rollingPath(lessons, contentVersion = 1) {
  return {
    id: "path-1",
    collectionId: "course-1",
    title: "Rolling course",
    mode: "rolling",
    status: "published",
    contentVersion,
    sourceHash: `source-${contentVersion}`,
    publishedAt: NOW,
    retiredAt: null,
    lessons,
  };
}

class DefinitionReaderFake {
  constructor(path) { this.path = path; }
  async findByPublicId(id) { return this.path.id === id ? structuredClone(this.path) : null; }
  async findActiveByCollectionPublicId(id) { return this.path.collectionId === id ? structuredClone(this.path) : null; }
}

class ProgressStoreFake {
  constructor() { this.value = { path: null, lessons: [], exercises: [] }; }
  async findForPath() { return structuredClone(this.value); }
  async upsertPathProgress(input) {
    this.value.path = {
      status: input.status,
      startedAt: this.value.path?.startedAt ?? input.startedAt,
      completedAt: input.completedAt ?? null,
      lastActivityAt: input.lastActivityAt,
      lastSeenContentVersion: input.lastSeenContentVersion,
    };
  }
  async upsertLessonProgress(input) {
    const next = {
      lessonId: input.lessonId,
      status: input.status,
      startedAt: this.value.lessons.find((item) => item.lessonId === input.lessonId)?.startedAt ?? input.startedAt,
      completedAt: input.completedAt ?? null,
      lastActivityAt: input.lastActivityAt,
    };
    this.value.lessons = [...this.value.lessons.filter((item) => item.lessonId !== input.lessonId), next];
  }
  async upsertExerciseProgress(input) {
    const next = {
      exerciseId: input.exerciseId,
      status: input.status,
      startedAt: this.value.exercises.find((item) => item.exerciseId === input.exerciseId)?.startedAt ?? input.startedAt,
      completedAt: input.completedAt ?? null,
      lastActivityAt: input.lastActivityAt,
      evidenceType: input.evidenceType ?? null,
      evidenceRef: input.evidenceRef ?? null,
    };
    this.value.exercises = [...this.value.exercises.filter((item) => item.exerciseId !== input.exerciseId), next];
  }
}

function harness({ canProgress = true } = {}) {
  const definitionReader = new DefinitionReaderFake(rollingPath([lesson("episode-1", 1, "exercise-1")]));
  const progressStore = new ProgressStoreFake();
  const accessReader = { async getForCollection() { return { canRead: true, canProgress }; } };
  const transactionManager = { async execute(work) { return work({}); } };
  const exerciseRuntime = new ExerciseRuntimeRegistry({
    completionPolicies: { explicit: async () => ({ evidenceType: null, evidenceRef: null }) },
  });
  const dependencies = {
    definitionReader,
    progressReader: progressStore,
    progressWriter: progressStore,
    accessReader,
    transactionManager,
    exerciseRuntime,
    clock: () => new Date(NOW),
  };
  return {
    definitionReader,
    progressStore,
    query: new GetCollectionLearningPath(dependencies),
    startExercise: new StartExercise(dependencies),
    completeExercise: new CompleteExercise(dependencies),
  };
}

async function completeFirstExercise(subject) {
  await subject.startExercise.execute("user-1", "path-1", "episode-1", "exercise-1");
  return subject.completeExercise.execute(
    "user-1",
    "path-1",
    "episode-1",
    "exercise-1",
    { kind: "completed" },
  );
}

describe("BBC Learning Path full journey application projection", () => {
  it("returns progress capability and the deterministic resume point in the collection read model", async () => {
    const subject = harness();
    const view = await subject.query.execute("user-1", "course-1");

    assert.deepEqual(view.access, { canProgress: true });
    assert.deepEqual(view.resumePoint, { lessonId: "episode-1", exerciseId: "exercise-1" });
    assert.equal(view.path.learnerStatus, "available");
  });

  it("keeps a public course readable before enrollment while exposing that progress needs enrollment", async () => {
    const subject = harness({ canProgress: false });
    const view = await subject.query.execute("user-1", "course-1");

    assert.deepEqual(view.access, { canProgress: false });
    assert.deepEqual(view.resumePoint, { lessonId: "episode-1", exerciseId: "exercise-1" });
  });

  it("preserves completed history and resumes the newly synchronized lesson after a rolling course was up to date", async () => {
    const subject = harness();
    const completed = await completeFirstExercise(subject);
    assert.equal(completed.pathStatus, "up_to_date");
    assert.equal(completed.resumePoint, null);

    subject.definitionReader.path = rollingPath([
      lesson("episode-1", 1, "exercise-1"),
      lesson("episode-2", 2, "exercise-2"),
    ], 2);

    const expanded = await subject.query.execute("user-1", "course-1");
    assert.equal(expanded.path.learnerStatus, "in_progress");
    assert.equal(expanded.lessons[0].state, "completed");
    assert.equal(expanded.lessons[1].state, "available");
    assert.deepEqual(expanded.resumePoint, { lessonId: "episode-2", exerciseId: "exercise-2" });
    assert.equal(subject.progressStore.value.path.lastSeenContentVersion, 1);
  });
});
