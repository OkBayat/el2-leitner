import assert from "node:assert/strict";
import { test } from "node:test";
import { MySqlListeningEpisodeSourceRepository } from "../src/infrastructure/persistence/mysql/MySqlListeningEpisodeSourceRepository.js";
import { SyncListeningEpisodeSources } from "../src/application/listening-practice/SyncListeningEpisodeSources.js";

function fixture({ acquired = 1, fail = false } = {}) {
  const events = [];
  const connection = {
    async execute(sql) { events.push(sql.includes("GET_LOCK") ? "lock" : "unlock"); return [[{ acquired }]]; },
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); }
  };
  const repository = new MySqlListeningEpisodeSourceRepository({ async getConnection() { return connection; } }, {
    collectionRepository: { async sync(_source, options) {
      assert.equal(options.connection, connection); events.push("vocabulary"); return { changed: true };
    } },
    async seed(options) {
      assert.equal(options.connection, connection); events.push("tests");
      if (fail) throw new Error("simulated invalid database write");
      return { changed: true, lessonCount: 1, testCount: 3, questionCount: 39 };
    }
  });
  return { events, repository };
}

test("sync shares one transaction for vocabulary, examples, metadata and tests", async () => {
  const { events, repository } = fixture();
  const result = await new SyncListeningEpisodeSources({ listeningEpisodeSourceRepository: repository }).execute([{ definition: {}, collection: {} }]);
  assert.equal(result.changedCollections, 1);
  assert.deepEqual(events, ["lock", "begin", "vocabulary", "tests", "commit", "unlock", "release"]);
});
test("a failed episode write rolls back vocabulary and always releases the deployment lock", async () => {
  const { events, repository } = fixture({ fail: true });
  await assert.rejects(repository.sync([{ definition: {}, collection: {} }]), /simulated/u);
  assert.deepEqual(events, ["lock", "begin", "vocabulary", "tests", "rollback", "unlock", "release"]);
});
test("concurrent deployments cannot synchronize a partially acquired catalog", async () => {
  const { events, repository } = fixture({ acquired: 0 });
  await assert.rejects(repository.sync([{ definition: {}, collection: {} }]), /Another deployment/u);
  assert.deepEqual(events, ["lock", "release"]);
});
test("an empty validated catalog is rejected rather than interpreted as deletion", async () => {
  await assert.rejects(new SyncListeningEpisodeSources({ listeningEpisodeSourceRepository: {} }).execute([]), /No validated/u);
});
