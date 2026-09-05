import assert from "node:assert/strict";
import { it } from "node:test";
import { MySqlSentencePracticeRepository } from "../src/infrastructure/persistence/mysql/MySqlSentencePracticeRepository.js";

function fixture(words = [], definitions = []) {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [sql.includes("collection_entry_definitions") ? definitions : words];
    }
  };
  return { repository: new MySqlSentencePracticeRepository(pool), calls };
}

const word = (overrides = {}) => ({
  word_id: "word-stationery", term: "stationery", accepted_form: "stationery",
  box: "1", mistake_count: "2", ...overrides
});
const definition = (overrides = {}) => ({
  word_id: "word-stationery", definition_id: "definition-1", language_code: "en",
  definition_text: "Materials used for writing, such as paper and pens.",
  collection_title: "Campus vocabulary", ...overrides
});

it("loads definitions in one bulk read, without multiplying accepted forms", async () => {
  const { repository, calls } = fixture(
    [word(), word({ accepted_form: "Stationery" }), word({ word_id: "word-pen", term: "pen", accepted_form: "pen" })],
    [definition(), definition(), definition({ definition_id: "definition-2", language_code: "fr", definition_text: "Papeterie" })]
  );
  const rows = await repository.findWordsForHouse("user-1", 1);
  assert.equal(calls.length, 2);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].box, 1);
  assert.equal(rows[0].mistakes, 2);
  assert.deepEqual(rows[0].definitions, [
    { id: "definition-1", languageCode: "en", text: "Materials used for writing, such as paper and pens.", collectionTitle: "Campus vocabulary" },
    { id: "definition-2", languageCode: "fr", text: "Papeterie", collectionTitle: "Campus vocabulary" }
  ]);
  assert.deepEqual(rows[1].definitions, rows[0].definitions);
  assert.deepEqual(rows[2].definitions, []);
});

it("scopes definitions to the learner's active house and accessible subscribed collections", async () => {
  const { repository, calls } = fixture([word()], [definition()]);
  await repository.findWordsForHouse("user-42", 3);
  const query = calls[1];
  assert.deepEqual(query.parameters, ["user-42", 3, "user-42"]);
  for (const pattern of [
    /uvp\.user_id = \?/u, /uvp\.box = \?/u, /uvp\.status = 'active'/u,
    /uvp\.mastered_at IS NULL/u, /ve\.status = 'active'/u,
    /uc\.user_id = uvp\.user_id/u, /uc\.status = 'active'/u,
    /ce\.removed_at IS NULL/u, /c\.archived_at IS NULL/u,
    /c\.visibility = 'public' AND c\.status = 'published'/u, /c\.owner_user_id = \?/u,
    /ORDER BY ve\.id, c\.id, d\.position, d\.id/u
  ]) assert.match(query.sql, pattern);
  assert.doesNotMatch(query.sql, /vocabulary_forms/u);
});

it("keeps words without definitions usable and ignores empty definition rows", async () => {
  const { repository } = fixture([word()], [definition({ definition_text: "   " })]);
  assert.deepEqual((await repository.findWordsForHouse("user-1", 1))[0].definitions, []);
});

it("does not query definitions for an empty house", async () => {
  const { repository, calls } = fixture();
  assert.deepEqual(await repository.findWordsForHouse("user-1", 1), []);
  assert.equal(calls.length, 1);
});
