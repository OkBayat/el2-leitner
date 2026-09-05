import assert from "node:assert/strict";
import { test } from "node:test";
import { MySqlListeningVocabularyRepository } from "../src/infrastructure/persistence/mysql/MySqlListeningVocabularyRepository.js";

test("vocabulary projections keep definitions/examples scoped and preserve all progress states", async () => {
  const calls = [];
  const results = [
    [{ public_id: "episode-1", slug: "screen-time", title: "Screen time", level: "intermediate", collection_id: "71", collection_public_id: "collection-1", subscription_status: "active" }],
    [
      { id: "10", public_id: "entry-new", vocabulary_id: "global-1", term: "intentional" },
      { id: "20", public_id: "entry-learning", vocabulary_id: "global-2", term: "enable", box: 3, introduced_on: "2026-01-01" },
      { id: "30", public_id: "entry-mastered", vocabulary_id: "global-3", term: "shift", box: 0, mastered_at: "2026-01-02" },
      { id: "40", public_id: "entry-excluded", vocabulary_id: "global-4", term: "eager", progress_status: "excluded" }
    ],
    [{ collection_entry_id: "10", definition_text: "Done deliberately." }, { collection_entry_id: "20", definition_text: "Make something possible." }],
    [{ collection_entry_id: "10", sentence_text: "It was an intentional choice." }]
  ];
  const repository = new MySqlListeningVocabularyRepository({ execute: async (sql, args) => {
    calls.push({ sql, args }); return [results[calls.length - 1]];
  } });
  const result = await repository.findForEpisode("42", "bbc_6_minute_english", "screen-time");
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[0].args, ["42", "bbc_6_minute_english", "screen-time"]);
  assert.deepEqual(calls[1].args, ["42", "71"]);
  assert.deepEqual(calls.slice(2).map((call) => call.args), [["71"], ["71"]]);
  assert.match(calls[0].sql, /l\.status = 'published'/u);
  assert.match(calls[0].sql, /c\.archived_at IS NULL/u);
  assert.equal(result.subscribed, true);
  assert.deepEqual(result.entries.map((entry) => entry.progress.state), ["new", "learning", "mastered", "excluded"]);
  assert.equal(result.entries[1].progress.box, 3);
  assert.deepEqual(result.entries[0].examples, ["It was an intentional choice."]);
  assert.deepEqual(result.entries[1].examples, []);
});

test("unpublished, unrelated or missing vocabulary collections are not exposed", async () => {
  const repository = new MySqlListeningVocabularyRepository({ execute: async () => [[]] });
  await assert.rejects(repository.findForEpisode("42", "bbc_6_minute_english", "missing"), { code: "LISTENING_VOCABULARY_NOT_FOUND" });
});
