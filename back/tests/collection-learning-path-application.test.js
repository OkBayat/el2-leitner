import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CompleteExercise } from "../src/application/collection-learning-path/commands/CompleteExercise.js";
import { StartExercise } from "../src/application/collection-learning-path/commands/StartExercise.js";
import { StartLearningPath } from "../src/application/collection-learning-path/commands/StartLearningPath.js";
import { RemoveLearningPathEnrollment } from "../src/application/collection-learning-path/commands/RemoveLearningPathEnrollment.js";
import { ExerciseRuntimeRegistry } from "../src/application/collection-learning-path/ExerciseRuntimeRegistry.js";
import { GetCollectionLearningPath } from "../src/application/collection-learning-path/queries/GetCollectionLearningPath.js";
import { GetExerciseContext } from "../src/application/collection-learning-path/queries/GetExerciseContext.js";
import { GetLearningPathLesson } from "../src/application/collection-learning-path/queries/GetLearningPathLesson.js";
import { GetLearningPathResumePoint } from "../src/application/collection-learning-path/queries/GetLearningPathResumePoint.js";

const NOW = "2026-09-06T15:00:00.000Z";

function exercise(id, position, overrides = {}) {
  return {
    id,
    position,
    type: "fixture.exercise",
    schemaVersion: 1,
    required: true,
    completionPolicy: "explicit",
    config: { fixture: id },
    status: "published",
    introducedVersion: 1,
    retiredVersion: null,
    publishedAt: NOW,
    retiredAt: null,
    ...overrides,
  };
}

function lesson(id, position, exercises, overrides = {}) {
  return {
    id,
    title: `Lesson ${position}`,
    position,
    sourceKind: "fixture",
    sourceRef: id,
    status: "published",
    introducedVersion: 1,
    retiredVersion: null,
    publishedAt: NOW,
    retiredAt: null,
    exercises,
    ...overrides,
  };
}

function pathDefinition(overrides = {}) {
  return {
    id: "path-1",
    collectionId: "collection-1",
    title: "Fixture path",
    mode: "finite",
    status: "published",
    contentVersion: 3,
    sourceHash: "private-source-hash",
    publishedAt: NOW,
    retiredAt: null,
    lessons: [
      lesson("lesson-1", 1, [
        exercise("exercise-1", 1),
        exercise("exercise-optional", 2, { required: false }),
        exercise("exercise-2", 3),
      ]),
      lesson("lesson-2", 2, [exercise("exercise-3", 1)]),
    ],
    ...overrides,
  };
}

class DefinitionReaderFake {
  constructor(path = pathDefinition()) {
    this.path = path;
  }

  async findByPublicId(id) {
    return this.path?.id === id ? structuredClone(this.path) : null;
  }

  async findActiveByCollectionPublicId(collectionId) {
    return this.path?.collectionId === collectionId ? structuredClone(this.path) : null;
  }
}

class AccessReaderFake {
  constructor({ canRead = true, canProgress = true } = {}) {
    this.access = { canRead, canProgress };
  }

  async getForCollection() {
    return this.access;
  }
}

class ProgressStoreFake {
  constructor() {
    this.byUserAndPath = new Map();
    this.writeCalls = [];
  }

  key(userId, pathId) {
    return `${userId}:${pathId}`;
  }

  record(userId, pathId) {
    const key = this.key(userId, pathId);
    if (!this.byUserAndPath.has(key)) {
      this.byUserAndPath.set(key, { enrolled: false, path: null, lessons: [], exercises: [] });
    }
    return this.byUserAndPath.get(key);
  }

  async findForPath(userId, pathId) {
    const current = this.byUserAndPath.get(this.key(userId, pathId));
    if (!current?.enrolled) return { path: null, lessons: [], exercises: [] };
    const { enrolled: _enrolled, ...progress } = current;
    return structuredClone(progress);
  }

  async upsertPathProgress(progress) {
    this.writeCalls.push(["path", structuredClone(progress)]);
    const record = this.record(progress.userId, progress.pathId);
    const previous = record.path;
    if (!previous || record.enrolled) {
      record.path = {
        status: progress.status,
        startedAt: previous?.startedAt ?? progress.startedAt,
        completedAt: progress.completedAt ?? null,
        lastActivityAt: progress.lastActivityAt,
        lastSeenContentVersion: Math.max(previous?.lastSeenContentVersion ?? 0, progress.lastSeenContentVersion ?? 0),
      };
    }
    record.enrolled = true;
    return { changed: true };
  }

  async upsertLessonProgress(progress) {
    this.writeCalls.push(["lesson", structuredClone(progress)]);
    const pathId = "path-1";
    const record = this.record(progress.userId, pathId);
    const index = record.lessons.findIndex((item) => item.lessonId === progress.lessonId);
    const previous = index >= 0 ? record.lessons[index] : null;
    const next = {
      lessonId: progress.lessonId,
      status: progress.status,
      startedAt: previous?.startedAt ?? progress.startedAt,
      completedAt: progress.completedAt ?? null,
      lastActivityAt: progress.lastActivityAt,
    };
    if (index >= 0) record.lessons[index] = next;
    else record.lessons.push(next);
    return { changed: true };
  }

  async upsertExerciseProgress(progress) {
    this.writeCalls.push(["exercise", structuredClone(progress)]);
    const pathId = "path-1";
    const record = this.record(progress.userId, pathId);
    const index = record.exercises.findIndex((item) => item.exerciseId === progress.exerciseId);
    const previous = index >= 0 ? record.exercises[index] : null;
    const next = {
      exerciseId: progress.exerciseId,
      status: progress.status,
      startedAt: previous?.startedAt ?? progress.startedAt,
      completedAt: progress.completedAt ?? null,
      lastActivityAt: progress.lastActivityAt,
      evidenceType: progress.evidenceType ?? null,
      evidenceRef: progress.evidenceRef ?? null,
    };
    if (index >= 0) record.exercises[index] = next;
    else record.exercises.push(next);
    return { changed: true };
  }

  async removePathEnrollment(userId, pathId) {
    this.writeCalls.push(["remove-enrollment", { userId, pathId }]);
    const record = this.byUserAndPath.get(this.key(userId, pathId));
    if (!record?.enrolled) return { changed: false };
    record.enrolled = false;
    return { changed: true };
  }
}

class TransactionManagerFake {
  constructor() {
    this.executions = 0;
  }

  async execute(work) {
    this.executions += 1;
    return work({ fixtureTransaction: true });
  }
}

function createHarness({ path = pathDefinition(), access, runtime, clock = () => new Date(NOW) } = {}) {
  const definitionReader = new DefinitionReaderFake(path);
  const progressStore = new ProgressStoreFake();
  const accessReader = new AccessReaderFake(access);
  const transactionManager = new TransactionManagerFake();
  const exerciseRuntime = runtime ?? new ExerciseRuntimeRegistry({
    completionPolicies: {
      explicit: async () => ({ evidenceType: null, evidenceRef: null }),
    },
    contextHydrators: {
      "fixture.exercise": async ({ exercise: selectedExercise }) => ({ hydratedFor: selectedExercise.id }),
    },
  });
  const dependencies = {
    definitionReader,
    progressReader: progressStore,
    progressWriter: progressStore,
    accessReader,
    transactionManager,
    exerciseRuntime,
    clock,
  };
  return {
    definitionReader,
    progressStore,
    transactionManager,
    queries: {
      collection: new GetCollectionLearningPath(dependencies),
      lesson: new GetLearningPathLesson(dependencies),
      context: new GetExerciseContext(dependencies),
      resume: new GetLearningPathResumePoint(dependencies),
    },
    commands: {
      startPath: new StartLearningPath(dependencies),
      removePath: new RemoveLearningPathEnrollment(dependencies),
      startExercise: new StartExercise(dependencies),
      completeExercise: new CompleteExercise(dependencies),
    },
  };
}

async function completeExplicit(harness, userId, lessonId, exerciseId) {
  await harness.commands.startExercise.execute(userId, "path-1", lessonId, exerciseId);
  return harness.commands.completeExercise.execute(userId, "path-1", lessonId, exerciseId, {
    kind: "completed",
  });
}

describe("Collection Learning Path application CQRS", () => {
  it("projects an unstarted path with server-derived locking and a first resume point", async () => {
    const harness = createHarness();
    const view = await harness.queries.collection.execute("user-1", "collection-1");

    assert.equal(view.path.id, "path-1");
    assert.equal(view.path.learnerStatus, "available");
    assert.equal(view.lessons[0].state, "available");
    assert.equal(view.lessons[0].exercises[0].state, "available");
    assert.equal(view.lessons[0].exercises[1].state, "locked");
    assert.equal(view.lessons[0].exercises[2].state, "locked");
    assert.equal(view.lessons[1].state, "locked");

    const resume = await harness.queries.resume.execute("user-1", "path-1");
    assert.deepEqual(resume, {
      pathId: "path-1",
      pathStatus: "available",
      resumePoint: { lessonId: "lesson-1", exerciseId: "exercise-1" },
    });
  });

  it("starts a path idempotently without trusting a client user id", async () => {
    const harness = createHarness();
    const first = await harness.commands.startPath.execute("user-1", "path-1");
    const second = await harness.commands.startPath.execute("user-1", "path-1");

    assert.equal(first.pathStatus, "in_progress");
    assert.equal(second.pathStatus, "in_progress");
    const writes = harness.progressStore.writeCalls.filter(([kind]) => kind === "path");
    assert.equal(writes.length, 2);
    assert.ok(writes.every(([, progress]) => progress.userId === "user-1"));
    assert.ok(writes.every(([, progress]) => progress.lastSeenContentVersion === 3));
  });

  it("starts a readable course without implicitly requiring a Leitner subscription", async () => {
    const harness = createHarness({ access: { canRead: true, canProgress: false } });
    const result = await harness.commands.startPath.execute("user-1", "path-1");
    assert.equal(result.pathStatus, "in_progress");
    assert.equal(harness.progressStore.writeCalls[0][0], "path");
  });

  it("removes course enrollment independently and makes the path available again", async () => {
    const harness = createHarness({ access: { canRead: true, canProgress: false } });
    await harness.commands.startPath.execute("user-1", "path-1");

    assert.deepEqual(await harness.commands.removePath.execute("user-1", "path-1"), {
      pathId: "path-1",
      removed: true,
    });
    assert.equal((await harness.queries.collection.execute("user-1", "collection-1")).path.learnerStatus, "available");
    assert.equal(harness.progressStore.record("user-1", "path-1").path.status, "in_progress");

    assert.equal((await harness.commands.startPath.execute("user-1", "path-1")).pathStatus, "in_progress");
    assert.equal(harness.progressStore.record("user-1", "path-1").path.status, "in_progress");
  });

  it("starts only available exercises and writes path, lesson, and exercise progress transactionally", async () => {
    const harness = createHarness();

    await assert.rejects(
      harness.commands.startExercise.execute("user-1", "path-1", "lesson-1", "exercise-2"),
      (error) => error?.code === "LEARNING_PATH_EXERCISE_LOCKED" && error?.statusCode === 409,
    );

    const result = await harness.commands.startExercise.execute(
      "user-1",
      "path-1",
      "lesson-1",
      "exercise-1",
    );
    assert.equal(result.exerciseStatus, "in_progress");
    assert.equal(harness.transactionManager.executions, 1);
    assert.deepEqual(
      harness.progressStore.writeCalls.map(([kind]) => kind),
      ["path", "lesson", "exercise"],
    );
  });

  it("restarts completed exercises by default without discarding prior completion", async () => {
    let now = NOW;
    let verificationCount = 0;
    const harness = createHarness({
      path: pathDefinition({
        lessons: [lesson("lesson-1", 1, [exercise("exercise-1", 1)])],
      }),
      clock: () => new Date(now),
      runtime: {
        hydrate: async () => ({ ready: true }),
        verifyCompletion: async () => {
          verificationCount += 1;
          return { evidenceType: null, evidenceRef: null };
        },
      },
    });
    await completeExplicit(harness, "user-1", "lesson-1", "exercise-1");
    assert.equal(verificationCount, 1);
    const writesBeforePractice = harness.progressStore.writeCalls.length;
    now = "2026-09-08T15:00:00.000Z";

    const restart = await harness.commands.startExercise.execute(
      "user-1",
      "path-1",
      "lesson-1",
      "exercise-1",
    );
    const context = await harness.queries.context.execute(
      "user-1",
      "path-1",
      "lesson-1",
      "exercise-1",
    );
    const course = await harness.queries.collection.execute("user-1", "collection-1");

    assert.equal(restart.exerciseStatus, "in_progress");
    assert.equal(context.state, "completed");
    assert.equal(context.progress.status, "completed");
    assert.equal(context.progress.completedAt, NOW);
    assert.equal(course.lessons[0].state, "completed");
    assert.equal(course.path.learnerStatus, "completed");
    assert.equal(harness.progressStore.writeCalls.length, writesBeforePractice);

    const repeatedCompletion = await harness.commands.completeExercise.execute(
      "user-1",
      "path-1",
      "lesson-1",
      "exercise-1",
      { kind: "completed" },
    );
    assert.equal(repeatedCompletion.exerciseStatus, "completed");
    assert.equal(verificationCount, 2);
    const completedAgain = await harness.queries.context.execute(
      "user-1",
      "path-1",
      "lesson-1",
      "exercise-1",
    );
    assert.equal(completedAgain.progress.completedAt, NOW);
    assert.equal(completedAgain.progress.lastActivityAt, NOW);
    assert.equal(harness.progressStore.writeCalls.length, writesBeforePractice);
  });

  it("keeps completed exercises closed when their config explicitly disables repeats", async () => {
    const harness = createHarness({
      path: pathDefinition({
        lessons: [lesson("lesson-1", 1, [
          exercise("exercise-1", 1, { config: { fixture: "exercise-1", repeatable: false } }),
        ])],
      }),
    });
    await completeExplicit(harness, "user-1", "lesson-1", "exercise-1");
    const writesBeforeRestart = harness.progressStore.writeCalls.length;

    const restart = await harness.commands.startExercise.execute(
      "user-1",
      "path-1",
      "lesson-1",
      "exercise-1",
    );

    assert.equal(restart.exerciseStatus, "completed");
    assert.equal(harness.progressStore.writeCalls.length, writesBeforeRestart);
  });

  it("hydrates exercise context through the exercise runtime registry instead of the HTTP layer", async () => {
    const harness = createHarness();
    const context = await harness.queries.context.execute(
      "user-1",
      "path-1",
      "lesson-1",
      "exercise-1",
    );

    assert.equal(context.exercise.id, "exercise-1");
    assert.equal(context.state, "available");
    assert.deepEqual(context.payload, { hydratedFor: "exercise-1" });
  });

  it("derives lesson and finite path completion while optional exercises never block progression", async () => {
    const harness = createHarness();
    await completeExplicit(harness, "user-1", "lesson-1", "exercise-1");

    const afterFirst = await harness.queries.resume.execute("user-1", "path-1");
    assert.deepEqual(afterFirst.resumePoint, { lessonId: "lesson-1", exerciseId: "exercise-optional" });

    await completeExplicit(harness, "user-1", "lesson-1", "exercise-2");
    const afterLesson = await harness.queries.resume.execute("user-1", "path-1");
    assert.deepEqual(afterLesson.resumePoint, { lessonId: "lesson-2", exerciseId: "exercise-3" });

    const final = await completeExplicit(harness, "user-1", "lesson-2", "exercise-3");
    assert.equal(final.lessonStatus, "completed");
    assert.equal(final.pathStatus, "completed");
    assert.equal(final.resumePoint, null);
  });

  it("uses up_to_date semantics when all currently published rolling lessons are complete", async () => {
    const harness = createHarness({
      path: pathDefinition({
        mode: "rolling",
        lessons: [lesson("lesson-1", 1, [exercise("exercise-1", 1)])],
      }),
    });
    const result = await completeExplicit(harness, "user-1", "lesson-1", "exercise-1");
    assert.equal(result.pathStatus, "up_to_date");
  });

  it("never accepts evidence-backed completion without a registered server-side policy", async () => {
    const path = pathDefinition({
      lessons: [lesson("lesson-1", 1, [
        exercise("exercise-1", 1, { completionPolicy: "submitted-listening-attempt" }),
      ])],
    });
    const harness = createHarness({ path, runtime: new ExerciseRuntimeRegistry() });
    await harness.commands.startExercise.execute("user-1", "path-1", "lesson-1", "exercise-1");

    await assert.rejects(
      harness.commands.completeExercise.execute("user-1", "path-1", "lesson-1", "exercise-1", {
        kind: "completed",
        evidence: { type: "listening-attempt", ref: "client-forged-attempt" },
      }),
      (error) => error?.code === "LEARNING_PATH_COMPLETION_POLICY_UNAVAILABLE" && error?.statusCode === 409,
    );
  });

  it("keeps progress isolated per authenticated learner", async () => {
    const harness = createHarness();
    await completeExplicit(harness, "user-1", "lesson-1", "exercise-1");

    const owner = await harness.queries.lesson.execute("user-1", "path-1", "lesson-1");
    const other = await harness.queries.lesson.execute("user-2", "path-1", "lesson-1");
    assert.equal(owner.exercises[0].state, "completed");
    assert.equal(other.exercises[0].state, "available");
  });
});
