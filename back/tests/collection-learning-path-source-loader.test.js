import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

import { parseFileManagedLearningPathSource } from "../src/domain/collection-learning-path/FileManagedLearningPathSource.js";
import { loadLearningPathSources } from "../src/infrastructure/content/loadLearningPathSources.js";

const SOURCES = new URL("../data/learning-paths/", import.meta.url);

function wordEditDistance(left, right) {
  const words = (value) => value.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)?/gu) ?? [];
  const source = words(left);
  const target = words(right);
  let row = Array.from({ length: target.length + 1 }, (_, index) => index);
  for (const [sourceIndex, sourceWord] of source.entries()) {
    const next = [sourceIndex + 1];
    for (const [targetIndex, targetWord] of target.entries()) {
      next.push(Math.min(next[targetIndex] + 1, row[targetIndex + 1] + 1,
        row[targetIndex] + (sourceWord === targetWord ? 0 : 1)));
    }
    row = next;
  }
  return row[target.length];
}

function definition(id, prefix) {
  return {
    schemaVersion: 1,
    managedIdPrefix: prefix,
    path: {
      id,
      collectionId: "cambridge-vocabulary-for-ielts",
      title: id,
      mode: "finite",
      status: "published",
    },
    lessons: [],
  };
}

test("file-managed source loader is deterministic and ignores non-JSON files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vocora-learning-path-"));
  try {
    await writeFile(join(directory, "z-last.json"), JSON.stringify(definition("z-learning-path", "z-")), "utf8");
    await writeFile(join(directory, "a-first.json"), JSON.stringify(definition("a-learning-path", "a-")), "utf8");
    await writeFile(join(directory, "README.md"), "not a source", "utf8");

    const sources = await loadLearningPathSources(pathToFileURL(`${directory}/`), parseFileManagedLearningPathSource);
    assert.deepEqual(sources.map((source) => source.fileName), ["a-first.json", "z-last.json"]);
    assert.deepEqual(sources.map((source) => source.definition.path.id), ["a-learning-path", "z-learning-path"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file-managed source loader rejects invalid filenames and duplicate managed prefixes", async () => {
  const invalidDirectory = await mkdtemp(join(tmpdir(), "vocora-learning-path-invalid-"));
  try {
    await writeFile(join(invalidDirectory, "Bad Name.json"), JSON.stringify(definition("bad-learning-path", "bad-")), "utf8");
    await assert.rejects(
      () => loadLearningPathSources(pathToFileURL(`${invalidDirectory}/`), parseFileManagedLearningPathSource),
      /filename/iu,
    );
  } finally {
    await rm(invalidDirectory, { recursive: true, force: true });
  }

  const duplicateDirectory = await mkdtemp(join(tmpdir(), "vocora-learning-path-duplicate-"));
  try {
    await writeFile(join(duplicateDirectory, "first.json"), JSON.stringify(definition("same-one-learning-path", "same-")), "utf8");
    await writeFile(join(duplicateDirectory, "second.json"), JSON.stringify(definition("same-two-learning-path", "same-")), "utf8");
    await assert.rejects(
      () => loadLearningPathSources(pathToFileURL(`${duplicateDirectory}/`), parseFileManagedLearningPathSource),
      /managedIdPrefix/iu,
    );
  } finally {
    await rm(duplicateDirectory, { recursive: true, force: true });
  }
});

test("all file-managed teaching cards use the markdown teaching contract", async () => {
  const sources = await loadLearningPathSources(SOURCES, parseFileManagedLearningPathSource);
  const teachingCards = sources.flatMap(({ definition: source }) => source.lessons.flatMap((lesson) =>
    lesson.exercises.flatMap((exercise) => exercise.config?.slides?.filter(
      (slide) => slide.type === "teaching-card") ?? [])));

  assert.ok(teachingCards.every((slide) => typeof slide.data.markdown === "string"));
  assert.ok(teachingCards.every((slide) => slide.data.markdown.includes("### ")));
  assert.ok(teachingCards.every((slide) => slide.data.markdown.includes("**")));
  assert.ok(teachingCards.every((slide) => !Object.hasOwn(slide.data, "blocks")));
  assert.ok(teachingCards.every((slide) => slide.chrome?.header?.progress === null));
});

test("Cambridge Grammar for IELTS Unit 1 exercises provide at least ten slides", async () => {
  const sources = await loadLearningPathSources(SOURCES, parseFileManagedLearningPathSource);
  const grammar = sources.find(({ fileName }) => fileName === "grammar-for-ielts.json");

  assert.ok(grammar);
  assert.equal(grammar.definition.path.title, "Cambridge Grammar for IELTS");
  assert.equal(grammar.definition.lessons[0].exercises.length, 14);
  assert.ok(grammar.definition.lessons[0].exercises.every(
    (exercise) => exercise.config.slides.length >= 10,
  ));
});

test("all file-managed rewrites are unambiguous one-or-two-word corrections", async () => {
  const sources = await loadLearningPathSources(SOURCES, parseFileManagedLearningPathSource);
  const rewrites = sources.flatMap(({ definition: source }) => source.lessons.flatMap((lesson) =>
    lesson.exercises.flatMap((exercise) => exercise.config?.slides?.filter(
      (slide) => slide.type === "rewrite") ?? [])));

  for (const slide of rewrites) {
    assert.ok(Array.isArray(slide.data.acceptedAnswers) && slide.data.acceptedAnswers.length > 0, slide.id);
    assert.equal(typeof slide.data.modelAnswer, "string", slide.id);
    for (const answer of new Set([slide.data.modelAnswer, ...slide.data.acceptedAnswers])) {
      assert.ok(wordEditDistance(slide.data.original, answer) >= 1, slide.id);
      assert.ok(wordEditDistance(slide.data.original, answer) <= 2, slide.id);
    }
  }
});
