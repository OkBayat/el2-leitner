import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFileManagedLearningPathSource } from "../src/domain/collection-learning-path/FileManagedLearningPathSource.js";
import { loadLearningPathSources } from "../src/infrastructure/content/loadLearningPathSources.js";

const SOURCES = new URL("../data/learning-paths/", import.meta.url);

test("Cambridge Vocabulary for IELTS is a complete finite 20-unit file-managed course", async () => {
  const sources = await loadLearningPathSources(SOURCES, parseFileManagedLearningPathSource);
  const source = sources.find(({ fileName }) => fileName === "cambridge-vocabulary-for-ielts.json");
  assert.ok(source);
  assert.equal(source.definition.path.collectionId, "cambridge-vocabulary-for-ielts");
  assert.equal(source.definition.path.mode, "finite");
  assert.equal(source.definition.lessons.length, 20);
  assert.deepEqual(source.definition.lessons.map((lesson) => lesson.position), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal(source.definition.lessons[0].title, "Unit 1 — Growing up");
  assert.equal(source.definition.lessons[19].title, "Unit 20 — The arts");
  assert.ok(source.definition.lessons.every((lesson) => lesson.source.kind === "collection-section"));
  assert.ok(source.definition.lessons.every((lesson) => lesson.source.collectionId === "cambridge-vocabulary-for-ielts"));
  assert.ok(source.definition.lessons.every((lesson) => lesson.exercises.length === 3));
  assert.equal(source.definition.lessons.flatMap((lesson) => lesson.exercises).length, 60);
  assert.ok(source.definition.lessons.flatMap((lesson) => lesson.exercises)
    .every((exercise) => exercise.config.scope?.kind === "lesson-source"));
});
