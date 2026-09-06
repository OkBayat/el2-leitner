import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { LearningPathCourseCatalogWriter } from "../src/application/collection-learning-path/ports/LearningPathCourseCatalogWriter.js";
import { BBC_SIX_MINUTE_ENGLISH_COURSE } from "../src/domain/collection-learning-path/BbcSixMinuteEnglishCourse.js";
import { MySqlLearningPathCourseCatalogCommandRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathCourseCatalogCommandRepository.js";
import { MySqlLearningPathDefinitionQueryRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathDefinitionQueryRepository.js";

class RecordingExecutor {
  constructor(responses = []) {
    this.responses = [...responses];
    this.calls = [];
  }

  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    return this.responses.shift() ?? [{ affectedRows: 1 }, []];
  }
}

test("managed course persistence implements its segregated application port and creates a course without vocabulary duplication", async () => {
  const executor = new RecordingExecutor([
    [[], []],
    [{ affectedRows: 1 }, []],
  ]);
  const repository = new MySqlLearningPathCourseCatalogCommandRepository({
    async execute() { throw new Error("transaction connection should be used"); },
  });

  assert.ok(repository instanceof LearningPathCourseCatalogWriter);
  const result = await repository.ensureCourse(BBC_SIX_MINUTE_ENGLISH_COURSE, { connection: executor });
  assert.equal(result.changed, true);
  assert.match(executor.calls[0].sql, /FROM collections/u);
  assert.match(executor.calls[1].sql, /INSERT INTO collections/u);
  assert.doesNotMatch(executor.calls[1].sql, /collection_entries|vocabulary_entries/u);
  assert.equal(executor.calls[1].parameters[0], "bbc-six-minute-english");
  assert.equal(executor.calls[1].parameters[4], "course");
});

test("managed course persistence refuses to take over a conflicting collection identity", async () => {
  const executor = new RecordingExecutor([
    [[{ id: "another-public-id", slug: "bbc-six-minute-english", ownerUserId: null }], []],
  ]);
  const repository = new MySqlLearningPathCourseCatalogCommandRepository(executor);
  await assert.rejects(
    repository.ensureCourse(BBC_SIX_MINUTE_ENGLISH_COURSE),
    (error) => error?.code === "LEARNING_PATH_COURSE_IDENTITY_CONFLICT",
  );
  assert.equal(executor.calls.length, 1);
});

test("Learning Path definition queries can participate in the same content synchronization transaction", async () => {
  const pool = new RecordingExecutor();
  const transaction = new RecordingExecutor([
    [[{
      id: "bbc-six-minute-english-learning-path",
      collectionId: "bbc-six-minute-english",
      title: "BBC 6 Minute English",
      mode: "rolling",
      status: "published",
      contentVersion: 1,
      sourceHash: "a".repeat(64),
      publishedAt: null,
      retiredAt: null,
    }], []],
    [[], []],
  ]);
  const repository = new MySqlLearningPathDefinitionQueryRepository(pool);
  const path = await repository.findByPublicId("bbc-six-minute-english-learning-path", {
    includeRetired: true,
    connection: transaction,
  });

  assert.equal(path.id, "bbc-six-minute-english-learning-path");
  assert.equal(transaction.calls.length, 2);
  assert.equal(pool.calls.length, 0);
});

test("database setup synchronizes the BBC Learning Path only after validated listening episode synchronization", async () => {
  const setup = await readFile(new URL("../scripts/setup-database.js", import.meta.url), "utf8");
  const listeningSync = setup.indexOf("const listeningSeedResult = await new SyncListeningEpisodeSources");
  const courseSync = setup.indexOf("const bbcCourseSyncResult = await createBbcCourseSourceSynchronizer");
  assert.ok(listeningSync >= 0);
  assert.ok(courseSync > listeningSync);
});
