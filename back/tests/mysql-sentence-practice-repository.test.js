import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MySqlSentencePracticeRepository } from "../src/infrastructure/persistence/mysql/MySqlSentencePracticeRepository.js";

function row(sourceItemNumber, audioId) {
  return {
    id: audioId,
    source_key: "tatoeba",
    source_item_number: sourceItemNumber,
    variant_number: audioId,
    category: "Tatoeba",
    sentence_text: `My name is speaker example ${sourceItemNumber}.`,
    audio_id: audioId,
    audio_url: `https://tatoeba.org/audio/download/${audioId}`,
    audio_contributor: `speaker-${audioId}`,
    audio_license: "CC BY 4.0",
    audio_attribution_url: null,
  };
}

describe("MySqlSentencePracticeRepository", () => {
  it("returns one runtime candidate per Tatoeba source sentence while retaining separate recordings in storage", async () => {
    const databaseRows = [
      row(10, 100),
      row(10, 101),
      row(9, 90),
      row(8, 80),
      row(7, 70),
      row(6, 60),
      row(5, 50),
    ];
    const calls = [];
    const pool = {
      async execute(sql, params) {
        calls.push({ sql, params });
        return [databaseRows];
      },
    };
    const repository = new MySqlSentencePracticeRepository(pool);

    const candidates = await repository.findCandidateSentences(["name"], "en", 6);

    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /MATCH\(sentence_text\)/u);
    assert.match(calls[0].sql, /LIMIT 24/u);
    assert.equal(candidates.length, 6);
    assert.deepEqual(candidates.map((candidate) => candidate.sourceItemNumber), [10, 9, 8, 7, 6, 5]);
    assert.equal(candidates[0].audioId, "100");
    assert.equal(candidates.some((candidate) => candidate.audioId === "101"), false);
  });
});
