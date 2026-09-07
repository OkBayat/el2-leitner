import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFileManagedLearningPathSource } from "../src/domain/collection-learning-path/FileManagedLearningPathSource.js";
import { projectLearningPathProgress } from "../src/domain/collection-learning-path/LearningPathProgression.js";
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
  assert.ok(source.definition.lessons.every((lesson) => lesson.exercises.length === 4));
  assert.equal(source.definition.lessons.flatMap((lesson) => lesson.exercises).length, 80);
  for (const lesson of source.definition.lessons) {
    assert.deepEqual(lesson.exercises.map((exercise) => exercise.position), [10, 20, 30, 40]);
    assert.equal(lesson.exercises[1].type, "slide-base");
    assert.equal(lesson.exercises[1].required, false);
    assert.equal(lesson.exercises[1].completionPolicy, "vocabulary-spelling");
    assert.deepEqual(lesson.exercises[1].config.slides.map((slide) => slide.type), [
      "leitner-house-one-scope",
      "summary",
    ]);
    assert.equal(lesson.exercises[1].config.slides[0].data.generatedSlide.type, "dictation");
    assert.deepEqual(Object.keys(lesson.exercises[1].config.slides[0].data), ["generatedSlide"]);
    assert.equal(lesson.exercises[1].config.slides[1].data.aggregationMode, "first-attempts");
    assert.equal(lesson.exercises[1].config.slides[1].terminal, true);
    assert.equal(lesson.exercises[2].type, "vocabulary.quick-review");
    assert.equal(lesson.exercises[3].type, "vocabulary.mastery-check");
  }
});

test("Cambridge spelling additions do not revoke previously completed learner progress", async () => {
  const sources = await loadLearningPathSources(SOURCES, parseFileManagedLearningPathSource);
  const definition = sources.find(({ fileName }) => fileName === "cambridge-vocabulary-for-ielts.json")?.definition;
  assert.ok(definition);
  const path = {
    ...definition.path,
    contentVersion: 2,
    lessons: definition.lessons.map((lesson) => ({
      ...lesson,
      status: "published",
      retiredAt: null,
      exercises: lesson.exercises.map((exercise) => ({ ...exercise, status: "published", retiredAt: null })),
    })),
  };
  const progress = {
    path: { status: "completed" },
    lessons: definition.lessons.map((lesson) => ({ lessonId: lesson.id, status: "completed" })),
    exercises: definition.lessons.flatMap((lesson) => lesson.exercises
      .filter((exercise) => exercise.type !== "slide-base")
      .map((exercise) => ({ exerciseId: exercise.id, status: "completed" }))),
  };

  const projected = projectLearningPathProgress(path, progress);

  assert.equal(projected.path.learnerStatus, "completed");
  assert.ok(projected.lessons.every((lesson) => lesson.state === "completed"));
  assert.ok(projected.lessons.every((lesson) => lesson.exercises[1].state === "available"));
});
