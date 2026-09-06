import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ActivateVocabularyIntake } from "../src/application/collection-learning-path/commands/ActivateVocabularyIntake.js";
import { GetVocabularyIntakeContext } from "../src/application/collection-learning-path/queries/GetVocabularyIntakeContext.js";
import { VerifyVocabularyIntakeCompletion } from "../src/application/collection-learning-path/queries/VerifyVocabularyIntakeCompletion.js";
import {
  createVocabularyIntakePayload,
  resolveVocabularyIntakeScope,
} from "../src/domain/collection-learning-path/VocabularyIntake.js";
import { classifyVocabularyProgress } from "../src/domain/learning/VocabularyProgress.js";

const NOW = "2026-09-06T18:00:00.000Z";

function intakeExercise(overrides = {}) {
  return {
    id: "intake-1",
    position: 1,
    type: "vocabulary.intake",
    schemaVersion: 1,
    required: true,
    completionPolicy: "vocabulary-intake",
    config: { scope: { kind: "listening-episode", ref: "episode-1" } },
    status: "published",
    introducedVersion: 1,
    retiredVersion: null,
    publishedAt: NOW,
    retiredAt: null,
    ...overrides,
  };
}

function pathDefinition() {
  return {
    id: "path-1",
    collectionId: "course-1",
    title: "Course",
    mode: "finite",
    status: "published",
    contentVersion: 1,
    publishedAt: NOW,
    retiredAt: null,
    lessons: [{
      id: "lesson-1",
      title: "Lesson 1",
      position: 1,
      sourceKind: "listening-episode",
      sourceRef: "episode-1",
      status: "published",
      introducedVersion: 1,
      retiredVersion: null,
      publishedAt: NOW,
      retiredAt: null,
      exercises: [intakeExercise()],
    }],
  };
}

const scopedItems = () => [
  { vocabularyId: "new-1", term: "new", definitions: ["new definition"], examples: ["new example"], progress: null },
  { vocabularyId: "learning-1", term: "learning", definitions: [], examples: [], progress: { status: "active", box: 3, introducedOn: "2026-09-01", masteredAt: null } },
  { vocabularyId: "mastered-1", term: "mastered", definitions: [], examples: [], progress: { status: "active", box: 5, introducedOn: "2026-08-01", masteredAt: NOW } },
  { vocabularyId: "excluded-1", term: "excluded", definitions: [], examples: [], progress: { status: "excluded", box: 0, introducedOn: null, masteredAt: null } },
];

class VocabularyIntakeStoreFake {
  constructor() {
    this.byUser = new Map([["user-1", scopedItems()]]);
    this.writeCalls = [];
  }

  async findForScope(userId, scope) {
    return { collectionId: "episode-vocab", scope, items: structuredClone(this.byUser.get(userId) ?? []) };
  }

  async activateUnseen(userId, input) {
    this.writeCalls.push({ userId, input: structuredClone(input) });
    const items = this.byUser.get(userId) ?? [];
    let activatedCount = 0;
    for (const item of items) {
      if (!input.vocabularyIds.includes(item.vocabularyId)) continue;
      if (classifyVocabularyProgress(item.progress) !== "new") continue;
      item.progress = { status: "active", box: 1, introducedOn: input.day, masteredAt: null };
      activatedCount += 1;
    }
    return { revision: 9, activatedCount };
  }
}

class DefinitionReaderFake {
  async findByPublicId(id) { return id === "path-1" ? pathDefinition() : null; }
}
class AccessReaderFake {
  async getForCollection() { return { canRead: true, canProgress: true }; }
}
class ProgressReaderFake {
  constructor({ started = true } = {}) { this.started = started; }
  async findForPath(userId) {
    if (userId !== "user-1") return { path: null, lessons: [], exercises: [] };
    return this.started ? {
      path: { status: "in_progress", startedAt: NOW, completedAt: null, lastActivityAt: NOW, lastSeenContentVersion: 1 },
      lessons: [{ lessonId: "lesson-1", status: "in_progress", startedAt: NOW, completedAt: null, lastActivityAt: NOW }],
      exercises: [{ exerciseId: "intake-1", status: "in_progress", startedAt: NOW, completedAt: null, lastActivityAt: NOW }],
    } : { path: null, lessons: [], exercises: [] };
  }
}

function commandHarness({ started = true } = {}) {
  const vocabulary = new VocabularyIntakeStoreFake();
  const command = new ActivateVocabularyIntake({
    definitionReader: new DefinitionReaderFake(),
    progressReader: new ProgressReaderFake({ started }),
    accessReader: new AccessReaderFake(),
    vocabularyIntakeReader: vocabulary,
    vocabularyIntakeWriter: vocabulary,
    clock: () => new Date(NOW),
  });
  return { command, vocabulary };
}

describe("Vocabulary intake domain and CQRS behavior", () => {
  it("classifies shared vocabulary state without treating excluded or mastered items as new", () => {
    assert.equal(classifyVocabularyProgress(null), "new");
    assert.equal(classifyVocabularyProgress({ status: "active", box: 2, introducedOn: "2026-09-01" }), "learning");
    assert.equal(classifyVocabularyProgress({ status: "active", box: 5, masteredAt: NOW }), "mastered");
    assert.equal(classifyVocabularyProgress({ status: "excluded", box: 0, introducedOn: null }), "excluded");
  });

  it("validates schema v1 listening-episode scope and rejects unsupported intake definitions", () => {
    assert.deepEqual(resolveVocabularyIntakeScope(intakeExercise()), { kind: "listening-episode", ref: "episode-1" });
    assert.throws(
      () => resolveVocabularyIntakeScope(intakeExercise({ schemaVersion: 2 })),
      (error) => error?.code === "INVALID_VOCABULARY_INTAKE_DEFINITION",
    );
    assert.throws(
      () => resolveVocabularyIntakeScope(intakeExercise({ config: { scope: { kind: "collection", ref: "course-1" } } })),
      (error) => error?.code === "INVALID_VOCABULARY_INTAKE_DEFINITION",
    );
    assert.throws(
      () => resolveVocabularyIntakeScope(intakeExercise({ completionPolicy: "explicit" })),
      (error) => error?.code === "INVALID_VOCABULARY_INTAKE_DEFINITION",
    );
  });

  it("builds a scoped payload that preserves mixed learner states", () => {
    const payload = createVocabularyIntakePayload(
      { kind: "listening-episode", ref: "episode-1" },
      scopedItems(),
    );
    assert.deepEqual(payload.summary, {
      total: 4,
      newCount: 1,
      learningCount: 1,
      masteredCount: 1,
      excludedCount: 1,
    });
    assert.deepEqual(payload.items.map((item) => [item.id, item.progress.state, item.progress.box]), [
      ["new-1", "new", 0],
      ["learning-1", "learning", 3],
      ["mastered-1", "mastered", 5],
      ["excluded-1", "excluded", 0],
    ]);
  });

  it("hydrates intake through the read side and verifies completion only after no new items remain", async () => {
    const vocabulary = new VocabularyIntakeStoreFake();
    const query = new GetVocabularyIntakeContext({ vocabularyIntakeReader: vocabulary });
    const verifier = new VerifyVocabularyIntakeCompletion({ vocabularyIntakeReader: vocabulary });
    const context = { userId: "user-1", exercise: intakeExercise() };

    const before = await query.execute(context);
    assert.equal(before.summary.newCount, 1);
    assert.equal(await verifier.execute(context), false);

    await vocabulary.activateUnseen("user-1", {
      vocabularyIds: before.items.map((item) => item.id),
      day: "2026-09-06",
      source: "learning-path",
    });
    assert.deepEqual(await verifier.execute(context), {
      evidenceType: "vocabulary-intake",
      evidenceRef: "listening-episode:episode-1",
    });
  });

  it("activates only unseen scoped items while preserving learning, mastered, and excluded progress", async () => {
    const { command, vocabulary } = commandHarness();
    const result = await command.execute("user-1", "path-1", "lesson-1", "intake-1");

    assert.equal(result.activatedCount, 1);
    assert.equal(result.summary.newCount, 0);
    assert.deepEqual(vocabulary.writeCalls[0], {
      userId: "user-1",
      input: {
        vocabularyIds: ["new-1", "learning-1", "mastered-1", "excluded-1"],
        day: "2026-09-06",
        source: "learning-path",
      },
    });
    const after = await vocabulary.findForScope("user-1", { kind: "listening-episode", ref: "episode-1" });
    assert.deepEqual(after.items.map((item) => [item.vocabularyId, classifyVocabularyProgress(item.progress), item.progress?.box ?? 0]), [
      ["new-1", "learning", 1],
      ["learning-1", "learning", 3],
      ["mastered-1", "mastered", 5],
      ["excluded-1", "excluded", 0],
    ]);
  });

  it("requires the authoritative exercise to be started before vocabulary can mutate", async () => {
    const { command, vocabulary } = commandHarness({ started: false });
    await assert.rejects(
      command.execute("user-1", "path-1", "lesson-1", "intake-1"),
      (error) => error?.code === "LEARNING_PATH_EXERCISE_NOT_STARTED" && error?.statusCode === 409,
    );
    assert.equal(vocabulary.writeCalls.length, 0);
  });
});
