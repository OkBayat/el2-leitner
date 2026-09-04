import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { VocabularyFileParser } from "../src/domain/library/VocabularyFileParser.js";

describe("VocabularyFileParser import accounting", () => {
  it("reports one source item for every structured vocabulary entry", () => {
    const parsed = new VocabularyFileParser().parse(`
# Example Book
## Spelling
- centre / center
  - definition: The middle part of something.
  - example: Meet me in the centre.
- colour / color
  - definition: The way something looks, such as red or blue.
  - example: Blue is my favorite colour.
- Monday
  - definition: The day after Sunday.
  - example: I work on Monday.
`);

    assert.equal(parsed.sourceItemCount, 3);
    assert.equal(parsed.entries.length, 3);
    assert.equal(parsed.duplicateCount, 0);
    assert.deepEqual(parsed.entries.map((entry) => entry.primaryForm), ["centre", "colour", "Monday"]);
  });

  it("enforces the vocabulary item limit", () => {
    const items = Array.from({ length: 20_001 }, (_, index) => `- word${index}\n  - definition: A simple word.\n  - example: This is word${index}.`).join("\n");
    const text = `# Large Book\n## Lesson 1\n${items}`;
    assert.throws(
      () => new VocabularyFileParser().parse(text),
      { code: "TOO_MANY_IMPORT_ITEMS", statusCode: 400 }
    );
  });
});
