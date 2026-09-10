import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlVocabularySourceRepository } from "../src/infrastructure/persistence/mysql/MySqlVocabularySourceRepository.js";

class PatternPool {
  constructor() { this.calls = []; }
  async execute(sql, parameters = []) {
    this.calls.push({ sql, parameters });
    if (sql.includes("collection_entry_definitions")) {
      return [[
        {
          vocabulary_public_id: "vocab-2",
          definition_id: "definition-1",
          language_code: "en",
          definition_text: "x".repeat(1500),
          collection_title: "1500 IELTS Listening Words"
        },
        {
          vocabulary_public_id: "vocab-2",
          definition_id: "definition-2",
          language_code: "en",
          definition_text: "a second complete definition",
          collection_title: "1500 IELTS Listening Words"
        }
      ], []];
    }
    return [[{
      vocabulary_public_id: "vocab-2",
      primary_form: "ability",
      source_pairs: "ielts\u001e1500 IELTS Listening Words"
    }], []];
  }
}

describe("MySqlVocabularySourceRepository", () => {
  it("filters the query by the requested public ids", async () => {
    const pool = new PatternPool();
    const repository = new MySqlVocabularySourceRepository(pool);

    const sources = await repository.findByVocabularyIds(7, ["vocab-1", "vocab-2"]);

    assert.equal(pool.calls.length, 2);
    assert.match(pool.calls[0].sql, /ve\.public_id IN \(\?, \?\)/u);
    assert.deepEqual(pool.calls[0].parameters, [7, "vocab-1", "vocab-2"]);
    assert.match(pool.calls[1].sql, /collection_entry_definitions/u);
    assert.deepEqual(pool.calls[1].parameters, [7, "vocab-2"]);
    assert.deepEqual(sources, [{
      vocabularyId: "vocab-2",
      term: "ability",
      collections: [{ id: "ielts", title: "1500 IELTS Listening Words" }],
      definitions: [
        {
          id: "definition-1",
          languageCode: "en",
          text: "x".repeat(1500),
          collectionTitle: "1500 IELTS Listening Words"
        },
        {
          id: "definition-2",
          languageCode: "en",
          text: "a second complete definition",
          collectionTitle: "1500 IELTS Listening Words"
        }
      ]
    }]);
  });

  it("does not hit MySQL for an empty page", async () => {
    const pool = new PatternPool();
    const repository = new MySqlVocabularySourceRepository(pool);
    assert.deepEqual(await repository.findByVocabularyIds(7, []), []);
    assert.equal(pool.calls.length, 0);
  });
});
