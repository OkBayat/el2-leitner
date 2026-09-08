import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlLearningPathProgressCommandRepository } from "../src/infrastructure/persistence/mysql/collection-learning-path/MySqlLearningPathProgressCommandRepository.js";

function progress(expectedRevision) {
  return {
    userId: "user-1",
    pathId: "cambridge-vocabulary-for-ielts-learning-path",
    status: "in_progress",
    startedAt: "2026-09-07T08:00:00.000Z",
    completedAt: null,
    lastActivityAt: "2026-09-07T08:30:00.000Z",
    lastSeenContentVersion: 2,
    expectedRevision,
  };
}

describe("MySQL Learning Path progress optimistic concurrency", () => {
  it("treats a no-op compare-and-swap as a stale write", async () => {
    const calls = [];
    const repository = new MySqlLearningPathProgressCommandRepository({
      async execute(sql, parameters) {
        calls.push({ sql, parameters });
        return [{ affectedRows: 0 }];
      },
    });

    const result = await repository.upsertPathProgress(progress(4));

    assert.equal(result.conflict, true);
    assert.match(
      calls[0].sql,
      /status = IF\(user_learning_path_progress\.revision = \?, VALUES\(status\), user_learning_path_progress\.status\)/u,
    );
    assert.match(
      calls[0].sql,
      /revision = IF\(user_learning_path_progress\.revision = \?, user_learning_path_progress\.revision \+ 1, user_learning_path_progress\.revision\)/u,
    );
    assert.equal(calls[0].parameters.at(-1), 4);
  });

  it("accepts an atomic revision match and reports the incremented revision", async () => {
    const repository = new MySqlLearningPathProgressCommandRepository({
      async execute() { return [{ affectedRows: 2 }]; },
    });

    const result = await repository.upsertPathProgress(progress(4));

    assert.deepEqual(result, { changed: true, conflict: false, revision: 5 });
  });

  it("rejects an unexpected insert for a non-zero revision so the transaction can roll it back", async () => {
    const repository = new MySqlLearningPathProgressCommandRepository({
      async execute() { return [{ affectedRows: 1 }]; },
    });

    const result = await repository.upsertPathProgress(progress(4));

    assert.deepEqual(result, { changed: false, conflict: true, revision: 4 });
  });
});
