import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseFileManagedLearningPathSource,
  validateFileManagedLearningPathSourceCatalog,
} from "../src/domain/collection-learning-path/FileManagedLearningPathSource.js";
import { SyncFileManagedLearningPathSources } from "../src/application/collection-learning-path/commands/SyncFileManagedLearningPathSources.js";

const COLLECTION_ID = "cambridge-vocabulary-for-ielts";
const PATH_ID = "cvfi-learning-path";
const SECTION_ID = "section-unit-01";

function rawSource({ lessons, title = "Cambridge Vocabulary for IELTS" } = {}) {
  return {
    schemaVersion: 1,
    managedIdPrefix: "cvfi-",
    path: {
      id: PATH_ID,
      collectionId: COLLECTION_ID,
      title,
      mode: "finite",
      status: "published",
    },
    lessons: lessons ?? [
      {
        id: "cvfi-unit-01",
        title: "Unit 1 — Growing up",
        position: 1,
        source: {
          kind: "collection-section",
          collectionId: COLLECTION_ID,
          sectionTitle: "Unit 1 — Growing up",
        },
        exercises: [
          {
            id: "cvfi-u01-intake",
            position: 10,
            type: "vocabulary.intake",
            schemaVersion: 1,
            required: true,
            completionPolicy: "vocabulary-intake",
            config: { scope: { kind: "lesson-source" } },
          },
          {
            id: "cvfi-u01-quick-review",
            position: 20,
            type: "vocabulary.quick-review",
            schemaVersion: 1,
            required: true,
            completionPolicy: "vocabulary-quick-review",
            config: { scope: { kind: "lesson-source" } },
          },
          {
            id: "cvfi-u01-mastery-check",
            position: 30,
            type: "vocabulary.mastery-check",
            schemaVersion: 1,
            required: true,
            completionPolicy: "vocabulary-mastery-check",
            config: { scope: { kind: "lesson-source" } },
          },
        ],
      },
    ],
  };
}

function parsedSource(overrides = {}) {
  return {
    fileName: "cambridge-vocabulary-for-ielts.json",
    definition: parseFileManagedLearningPathSource(rawSource(overrides)),
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
    assert.equal(pathId, PATH_ID);
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

class MemorySourceReferences {
  constructor({ missingCollection = false, missingSection = false } = {}) {
    this.missingCollection = missingCollection;
    this.missingSection = missingSection;
  }

  async findCollectionByPublicId(publicId) {
    if (this.missingCollection || publicId !== COLLECTION_ID) return null;
    return { id: COLLECTION_ID, title: "Cambridge Vocabulary for IELTS" };
  }

  async findCollectionSection({ collectionId, sectionTitle }) {
    if (this.missingSection || collectionId !== COLLECTION_ID || sectionTitle !== "Unit 1 — Growing up") return null;
    return {
      id: SECTION_ID,
      collectionId: COLLECTION_ID,
      title: "Unit 1 — Growing up",
    };
  }
}

class ImmediateTransactionManager {
  async execute(work) {
    return work({ transaction: "test" });
  }
}

function synchronizer({ store = new MemoryDefinitions(), references = new MemorySourceReferences() } = {}) {
  return {
    store,
    command: new SyncFileManagedLearningPathSources({
      definitionReader: store,
      definitionWriter: store,
      sourceReferenceReader: references,
      transactionManager: new ImmediateTransactionManager(),
      now: () => new Date("2026-09-07T06:00:00.000Z"),
    }),
  };
}

test("file-managed source validates a finite course and preserves declarative lesson/exercise ordering", () => {
  const definition = parseFileManagedLearningPathSource(rawSource());

  assert.equal(definition.schemaVersion, 1);
  assert.equal(definition.managedIdPrefix, "cvfi-");
  assert.equal(definition.path.id, PATH_ID);
  assert.equal(definition.path.collectionId, COLLECTION_ID);
  assert.equal(definition.path.mode, "finite");
  assert.equal(definition.lessons.length, 1);
  assert.deepEqual(definition.lessons[0].exercises.map((exercise) => exercise.position), [10, 20, 30]);
  assert.deepEqual(definition.lessons[0].source, {
    kind: "collection-section",
    collectionId: COLLECTION_ID,
    sectionTitle: "Unit 1 — Growing up",
  });
});

test("file-managed source rejects unstable identities, duplicate positions, and cross-collection lesson references", () => {
  assert.throws(
    () => parseFileManagedLearningPathSource(rawSource({ lessons: [
      {
        id: "unit-without-managed-prefix",
        title: "Unit 1",
        position: 1,
        source: { kind: "collection-section", collectionId: COLLECTION_ID, sectionTitle: "Unit 1 — Growing up" },
        exercises: [],
      },
    ] })),
    /managedIdPrefix/u,
  );

  const duplicatePositions = rawSource().lessons[0].exercises.map((exercise) => ({ ...exercise }));
  duplicatePositions[1].position = duplicatePositions[0].position;
  assert.throws(
    () => parseFileManagedLearningPathSource(rawSource({ lessons: [{ ...rawSource().lessons[0], exercises: duplicatePositions }] })),
    /position/u,
  );

  assert.throws(
    () => parseFileManagedLearningPathSource(rawSource({ lessons: [{
      ...rawSource().lessons[0],
      source: { kind: "collection-section", collectionId: "another-collection", sectionTitle: "Unit 1 — Growing up" },
    }] })),
    /collection/u,
  );
});

test("catalog validation prevents public-id collisions across multiple managed files", () => {
  const first = parseFileManagedLearningPathSource(rawSource());
  const second = parseFileManagedLearningPathSource({
    ...rawSource(),
    managedIdPrefix: "other-",
    path: { ...rawSource().path, id: "other-learning-path" },
    lessons: [{
      ...rawSource().lessons[0],
      id: "other-unit-01",
      exercises: [{ ...rawSource().lessons[0].exercises[0], id: "cvfi-u01-intake" }],
    }],
  });

  assert.throws(() => validateFileManagedLearningPathSourceCatalog([first, second]), /exercise.*cvfi-u01-intake/iu);
});

test("synchronization resolves collection-section references, materializes lesson-source scopes, and is idempotent", async () => {
  const fixture = synchronizer();
  const source = parsedSource();

  const first = await fixture.command.execute([source]);
  assert.equal(first.changed, true);
  assert.equal(first.sourcesChanged, 1);
  assert.equal(fixture.store.path.contentVersion, 1);
  assert.equal(fixture.store.path.mode, "finite");
  const lesson = fixture.store.path.lessons[0];
  assert.equal(lesson.sourceKind, "collection-section");
  assert.equal(lesson.sourceRef, SECTION_ID);
  assert.deepEqual(lesson.exercises.map((exercise) => exercise.config), [
    { scope: { kind: "collection-section", ref: SECTION_ID } },
    { scope: { kind: "collection-section", ref: SECTION_ID } },
    { scope: { kind: "collection-section", ref: SECTION_ID } },
  ]);

  const mutationCount = fixture.store.mutations.length;
  const second = await fixture.command.execute([source]);
  assert.equal(second.changed, false);
  assert.equal(second.sourcesChanged, 0);
  assert.equal(fixture.store.path.contentVersion, 1);
  assert.equal(fixture.store.mutations.length, mutationCount);
});

test("file source evolution versions effective changes and soft-retires only ids owned by its managed prefix", async () => {
  const fixture = synchronizer();
  await fixture.command.execute([parsedSource()]);
  fixture.store.path.lessons[0].exercises.push({
    id: "future-custom-exercise",
    position: 40,
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

  const reducedLesson = {
    ...rawSource().lessons[0],
    exercises: rawSource().lessons[0].exercises.slice(0, 2),
  };
  const changed = await fixture.command.execute([parsedSource({ title: "Cambridge Vocabulary for IELTS — Updated", lessons: [reducedLesson] })]);

  assert.equal(changed.changed, true);
  assert.equal(fixture.store.path.contentVersion, 2);
  const lesson = fixture.store.path.lessons[0];
  assert.equal(lesson.exercises.find((exercise) => exercise.id === "cvfi-u01-mastery-check").status, "retired");
  assert.equal(lesson.exercises.find((exercise) => exercise.id === "future-custom-exercise").status, "published");
});

test("removing a managed lesson retires its managed exercises and lesson without deleting persisted identities", async () => {
  const fixture = synchronizer();
  await fixture.command.execute([parsedSource()]);

  const result = await fixture.command.execute([parsedSource({ lessons: [] })]);
  assert.equal(result.changed, true);
  assert.equal(fixture.store.path.contentVersion, 2);
  assert.equal(fixture.store.path.lessons[0].status, "retired");
  assert.equal(fixture.store.path.lessons[0].retiredVersion, 2);
  assert.ok(fixture.store.path.lessons[0].exercises.every((exercise) => exercise.status === "retired"));
});

test("missing collection or section references fail before any Learning Path definition mutation", async () => {
  const missingCollection = synchronizer({ references: new MemorySourceReferences({ missingCollection: true }) });
  await assert.rejects(() => missingCollection.command.execute([parsedSource()]), /collection/u);
  assert.equal(missingCollection.store.mutations.length, 0);

  const missingSection = synchronizer({ references: new MemorySourceReferences({ missingSection: true }) });
  await assert.rejects(() => missingSection.command.execute([parsedSource()]), /section/u);
  assert.equal(missingSection.store.mutations.length, 0);
});
