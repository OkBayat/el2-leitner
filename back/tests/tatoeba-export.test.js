import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isReusableTatoebaAudio,
  parseTatoebaAudioLine,
  parseTatoebaSentenceLine,
  pickPreferredTatoebaAudio,
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

  it("prefers reusable licensed audio when a sentence has multiple recordings", () => {
    const restricted = parseTatoebaAudioLine("123\t100\tspeaker-a\t\t");
    const reusable = parseTatoebaAudioLine("123\t200\tspeaker-b\tCC BY 4.0\thttps://example.test/b");

    assert.equal(isReusableTatoebaAudio(restricted), false);
    assert.equal(isReusableTatoebaAudio(reusable), true);
    assert.deepEqual(pickPreferredTatoebaAudio(restricted, reusable), reusable);
  });

  it("chooses the lowest audio id deterministically when licenses are equivalent", () => {
    const high = parseTatoebaAudioLine("123\t300\ta\tCC0\t");
    const low = parseTatoebaAudioLine("123\t250\tb\tCC BY 4.0\t");
    assert.deepEqual(pickPreferredTatoebaAudio(high, low), low);
  });
});
