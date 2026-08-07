import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { VocabularyFileParser } from "../src/domain/library/VocabularyFileParser.js";

describe("VocabularyFileParser import accounting", () => {
  it("reports source rows separately from canonical vocabulary identities", () => {
    const parsed = new VocabularyFileParser().parse(`
## Spelling
1. centre / center
2. center
3. colour / color
4. color
5. Monday
`);

    assert.equal(parsed.sourceItemCount, 5);
    assert.equal(parsed.entries.length, 3);
    assert.equal(parsed.duplicateCount, 2);
    assert.deepEqual(parsed.entries.map((entry) => entry.primaryForm), ["centre", "colour", "Monday"]);
  });

  it("counts the source item limit before deduplication so duplicate-heavy files cannot bypass it", () => {
    const text = Array.from({ length: 20_001 }, (_, index) => `${index + 1}. Monday`).join("\n");
    assert.throws(
      () => new VocabularyFileParser().parse(text),
      { code: "TOO_MANY_IMPORT_ITEMS", statusCode: 400 }
    );
  });
});
