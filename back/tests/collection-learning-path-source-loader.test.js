import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

import { parseFileManagedLearningPathSource } from "../src/domain/collection-learning-path/FileManagedLearningPathSource.js";
import { loadLearningPathSources } from "../src/infrastructure/content/loadLearningPathSources.js";

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
