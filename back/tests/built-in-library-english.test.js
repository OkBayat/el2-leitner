import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  IELTS_COLLECTION_DESCRIPTION,
  IELTS_COLLECTION_ID,
  IELTS_COLLECTION_TITLE,
  seedBuiltInLibrary
} from "../src/infrastructure/persistence/mysql/seedBuiltInLibrary.js";

test("built-in IELTS collection metadata is English and refreshed for an existing seed", async () => {
  assert.equal(IELTS_COLLECTION_TITLE, "1500 IELTS Listening Words");
  assert.match(IELTS_COLLECTION_DESCRIPTION, /IELTS Listening/u);
  assert.doesNotMatch(`${IELTS_COLLECTION_TITLE} ${IELTS_COLLECTION_DESCRIPTION}`, /\p{Script=Arabic}/u);

  const sourceText = "1. alpha";
  const sourceHash = createHash("sha256").update(sourceText, "utf8").digest("hex");
  const calls = [];
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) return [[{ id: 1, source_hash: sourceHash }]];
      return [{ affectedRows: 1 }];
    }
  };

  const result = await seedBuiltInLibrary({
    pool,
    sourceText,
    parser: { parse() { throw new Error("parser must not run when the source hash is unchanged"); } }
  });

  assert.equal(result.changed, false);
  assert.match(calls[1].sql, /title\s*=\s*\?/u);
  assert.match(calls[1].sql, /description\s*=\s*\?/u);
  assert.deepEqual(calls[1].params, [IELTS_COLLECTION_TITLE, IELTS_COLLECTION_DESCRIPTION, IELTS_COLLECTION_ID]);
});
