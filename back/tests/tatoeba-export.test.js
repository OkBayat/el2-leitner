import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isReusableTatoebaAudio,
  parseTatoebaAudioLine,
  parseTatoebaSentenceLine,
  tatoebaAudioDownloadUrl,
} from "../src/infrastructure/tatoeba/TatoebaExport.js";

describe("TatoebaExport", () => {
  it("parses the official English sentence export format", () => {
    assert.deepEqual(parseTatoebaSentenceLine("123\teng\tWhat is your name?"), {
      sentenceId: 123,
      languageCode: "eng",
      text: "What is your name?",
    });
  });

  it("parses audio license and attribution metadata", () => {
    assert.deepEqual(
      parseTatoebaAudioLine("123\t456\tCK\tCC BY 4.0\thttps://example.test/ck"),
      {
        sentenceId: 123,
        audioId: 456,
        contributor: "CK",
        license: "CC BY 4.0",
        attributionUrl: "https://example.test/ck",
      }
    );
    assert.equal(tatoebaAudioDownloadUrl(456), "https://tatoeba.org/audio/download/456");
  });

  it("keeps separate audio rows when the same sentence has multiple recordings", () => {
    const first = parseTatoebaAudioLine("123\t100\tspeaker-a\tCC0\t");
    const second = parseTatoebaAudioLine("123\t200\tspeaker-b\tCC BY 4.0\thttps://example.test/b");

    assert.equal(first.sentenceId, second.sentenceId);
    assert.notEqual(first.audioId, second.audioId);
    assert.deepEqual([first.audioId, second.audioId], [100, 200]);
  });

  it("marks only recordings with an explicit license as reusable", () => {
    const restricted = parseTatoebaAudioLine("123\t100\tspeaker-a\t\t");
    const reusable = parseTatoebaAudioLine("123\t200\tspeaker-b\tCC BY 4.0\thttps://example.test/b");

    assert.equal(isReusableTatoebaAudio(restricted), false);
    assert.equal(isReusableTatoebaAudio(reusable), true);
  });
});
