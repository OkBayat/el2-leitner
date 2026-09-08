import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BBC_SIX_MINUTE_ENGLISH_COURSE,
  BBC_SIX_MINUTE_ENGLISH_PATH,
  buildBbcSixMinuteEnglishCourseSource,
} from "../src/domain/collection-learning-path/BbcSixMinuteEnglishCourse.js";
import { SyncBbcSixMinuteEnglishCourseSource } from "../src/application/collection-learning-path/commands/SyncBbcSixMinuteEnglishCourseSource.js";

function episode({
  publicId = "bbc-6-minute-english-260402",
  slug = "are-saunas-good-for-you",
  title = "Are saunas good for you?",
  episodeCode = "260402",
  episodeDate = "2026-04-02",
  status = "published",
  provider = "bbc_6_minute_english",
  tests = [
    { id: "test-1", title: "Test 1", position: 1 },
    { id: "test-2", title: "Test 2", position: 2 },
  ],
} = {}) {
  return {
    definition: {
      publicId,
      slug,
      title,
      episodeCode,
      episodeDate,
      publishedAt: `${episodeDate}T08:50:00.000Z`,
      status,
      provider,
      tests,
    },
  };
}

class MemoryDefinitions {
  constructor() {
    this.path = null;
    this.mutations = [];
  }

  async findByPublicId(publicId) {
    if (!this.path || this.path.id !== publicId) return null;
    return structuredClone(this.path);
  }

  async upsertPath(path) {
    this.mutations.push(["path", path.id]);
    const lessons = this.path?.lessons ?? [];
    this.path = { ...structuredClone(path), lessons };
    return { changed: true };
  }

  async upsertLesson(pathId, lesson) {
    this.mutations.push(["lesson", lesson.id]);
    assert.equal(pathId, BBC_SIX_MINUTE_ENGLISH_PATH.id);
    const existing = this.path.lessons.find((item) => item.id === lesson.id);
    const exercises = existing?.exercises ?? [];
    const next = { ...structuredClone(lesson), exercises };
    if (existing) Object.assign(existing, next);
    else this.path.lessons.push(next);
    return { changed: true };
  }

  async upsertExercise(lessonId, exercise) {
    this.mutations.push(["exercise", exercise.id]);
    const lesson = this.path.lessons.find((item) => item.id === lessonId);
    assert.ok(lesson);
    const existing = lesson.exercises.find((item) => item.id === exercise.id);
    const next = structuredClone(exercise);
    if (existing) Object.assign(existing, next);
    else lesson.exercises.push(next);
    return { changed: true };
  }

  async retireLesson(lessonId, retirement) {
    this.mutations.push(["retire-lesson", lessonId]);
    const lesson = this.path.lessons.find((item) => item.id === lessonId);
    if (!lesson || lesson.retiredAt) return { changed: false };
    lesson.status = "retired";
    lesson.retiredVersion = retirement.version;
    lesson.retiredAt = retirement.at;
    return { changed: true };
  }

  async retireExercise(exerciseId, retirement) {
    this.mutations.push(["retire-exercise", exerciseId]);
    const exercise = this.path.lessons.flatMap((lesson) => lesson.exercises)
      .find((item) => item.id === exerciseId);
    if (!exercise || exercise.retiredAt) return { changed: false };
    exercise.status = "retired";
    exercise.retiredVersion = retirement.version;
    exercise.retiredAt = retirement.at;
    return { changed: true };
  }
}

class MemoryCourseCatalog {
  constructor() {
    this.course = null;
    this.mutations = 0;
  }

  async ensureCourse(course) {
    const next = structuredClone(course);
    if (this.course && JSON.stringify(this.course) === JSON.stringify(next)) return { changed: false };
    this.course = next;
    this.mutations += 1;
    return { changed: true };
  }
}

class ImmediateTransactionManager {
  async execute(work) {
    return work({ transaction: "test" });
  }
}

function synchronizer(store = new MemoryDefinitions(), courses = new MemoryCourseCatalog()) {
  const now = () => new Date("2026-09-06T20:00:00.000Z");
  return {
    store,
    courses,
    command: new SyncBbcSixMinuteEnglishCourseSource({
      courseCatalogWriter: courses,
      definitionReader: store,
      definitionWriter: store,
      transactionManager: new ImmediateTransactionManager(),
      now,
    }),
  };
}

test("BBC source maps one published episode to one rolling lesson with scoped vocabulary and every IELTS test", () => {
  const source = buildBbcSixMinuteEnglishCourseSource([episode()]);

  assert.deepEqual(source.course, BBC_SIX_MINUTE_ENGLISH_COURSE);
  assert.equal(source.path.id, BBC_SIX_MINUTE_ENGLISH_PATH.id);
  assert.equal(source.path.mode, "rolling");
  assert.equal(source.episodes.length, 1);
  assert.equal(source.episodes[0].action, "publish");

  const lesson = source.episodes[0].lesson;
  assert.equal(lesson.id, "bbc-6-minute-english-260402");
  assert.equal(lesson.position, 20260402);
  assert.equal(lesson.sourceKind, "listening-episode");
  assert.equal(lesson.sourceRef, "bbc-6-minute-english-260402");
  assert.deepEqual(lesson.exercises.map((item) => item.type), [
    "vocabulary.intake",
    "vocabulary.quick-review",
    "vocabulary.mastery-check",
    "listening.ielts",
    "listening.ielts",
  ]);
  assert.deepEqual(lesson.exercises.slice(0, 3).map((item) => item.config), [
    { scope: { kind: "listening-episode", ref: "bbc-6-minute-english-260402" } },
    { scope: { kind: "listening-episode", ref: "bbc-6-minute-english-260402" } },
    { scope: { kind: "listening-episode", ref: "bbc-6-minute-english-260402" } },
  ]);
  assert.deepEqual(lesson.exercises.slice(3).map((item) => item.config), [
    { lessonSlug: "are-saunas-good-for-you", testId: "test-1" },
    { lessonSlug: "are-saunas-good-for-you", testId: "test-2" },
  ]);
});

test("BBC source ordering and stable identities do not depend on mutable titles or catalog array order", () => {
  const newer = episode({
    publicId: "bbc-6-minute-english-260409",
    slug: "the-future-of-food",
    title: "The future of food",
    episodeCode: "260409",
    episodeDate: "2026-04-09",
  });
  const first = buildBbcSixMinuteEnglishCourseSource([newer, episode()]);
  const renamed = buildBbcSixMinuteEnglishCourseSource([
    episode({ title: "Renamed safely" }),
    newer,
  ]);

  assert.deepEqual(first.episodes.map((item) => item.lesson.position), [20260402, 20260409]);
  assert.deepEqual(
    first.episodes[0].lesson.exercises.map((item) => item.id),
    renamed.episodes[0].lesson.exercises.map((item) => item.id),
  );
});

test("non-BBC sources are ignored and archived BBC episodes are explicit retirement instructions", () => {
  const source = buildBbcSixMinuteEnglishCourseSource([
    episode({ provider: "voice_of_america" }),
    episode({ status: "archived" }),
  ]);
  assert.equal(source.sourceCount, 1);
  assert.equal(source.episodes.length, 1);
  assert.deepEqual(source.episodes[0], {
    sourceRef: "bbc-6-minute-english-260402",
    action: "retire",
  });
});

test("synchronization is idempotent, versions only effective definition changes, and appends newly discovered tests", async () => {
  const fixture = synchronizer();
  const first = await fixture.command.execute([episode()]);
  assert.equal(first.changed, true);
  assert.equal(first.contentVersion, 1);
  assert.equal(fixture.store.path.lessons.length, 1);
  assert.equal(fixture.store.path.lessons[0].exercises.length, 5);

  const mutationCount = fixture.store.mutations.length;
  const second = await fixture.command.execute([episode()]);
  assert.equal(second.changed, false);
  assert.equal(second.contentVersion, 1);
  assert.equal(fixture.store.mutations.length, mutationCount);

  const expanded = episode({ tests: [
    { id: "test-1", title: "Test 1", position: 1 },
    { id: "test-2", title: "Test 2", position: 2 },
    { id: "test-3", title: "Test 3", position: 3 },
  ] });
  const third = await fixture.command.execute([expanded]);
  assert.equal(third.changed, true);
  assert.equal(third.contentVersion, 2);
  const lesson = fixture.store.path.lessons[0];
  assert.equal(lesson.exercises.length, 6);
  assert.equal(lesson.introducedVersion, 1);
  assert.equal(lesson.exercises.find((item) => item.id.endsWith("test-1")).introducedVersion, 1);
  assert.equal(lesson.exercises.find((item) => item.id.endsWith("test-3")).introducedVersion, 2);
});

test("missing source files never imply deletion, while an explicit archived source soft-retires the lesson", async () => {
  const fixture = synchronizer();
  await fixture.command.execute([episode()]);
  const mutationsBeforeMissingCatalog = fixture.store.mutations.length;

  const missing = await fixture.command.execute([]);
  assert.equal(missing.changed, false);
  assert.equal(missing.skipped, true);
  assert.equal(fixture.store.mutations.length, mutationsBeforeMissingCatalog);
  assert.equal(fixture.store.path.lessons[0].status, "published");

  const archived = await fixture.command.execute([episode({ status: "archived" })]);
  assert.equal(archived.changed, true);
  assert.equal(archived.contentVersion, 2);
  assert.equal(fixture.store.path.lessons[0].status, "retired");
  assert.equal(fixture.store.path.lessons[0].retiredVersion, 2);
});

test("removing a test from an existing published episode soft-retires only the managed test exercise", async () => {
  const fixture = synchronizer();
  await fixture.command.execute([episode()]);
  fixture.store.path.lessons[0].exercises.push({
    id: "custom-future-exercise",
    position: 50,
    type: "future.custom",
    schemaVersion: 1,
    required: false,
    completionPolicy: "future",
    config: {},
    status: "published",
    introducedVersion: 1,
    retiredVersion: null,
    retiredAt: null,
  });

  const result = await fixture.command.execute([episode({ tests: [
    { id: "test-1", title: "Test 1", position: 1 },
  ] })]);
  assert.equal(result.contentVersion, 2);
  const lesson = fixture.store.path.lessons[0];
  assert.equal(lesson.exercises.find((item) => item.id.endsWith("test-2")).status, "retired");
  assert.equal(lesson.exercises.find((item) => item.id === "custom-future-exercise").status, "published");
});
