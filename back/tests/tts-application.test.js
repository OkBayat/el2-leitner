import assert from "node:assert/strict";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { SynthesizeSpeech } from "../src/application/text-to-speech/SynthesizeSpeech.js";
import { createCanonicalTtsRequest } from "../src/domain/text-to-speech/TtsRequest.js";
import { buildTtsCacheKey } from "../src/domain/text-to-speech/TtsCacheKey.js";
import { FileTtsAudioCache } from "../src/infrastructure/text-to-speech/FileTtsAudioCache.js";
import { AppError } from "../src/domain/errors.js";

const directories = [];
const requestOptions = {
  allowedVoices: ["af_heart", "af_sky"],
  defaultVoice: "af_heart",
  defaultSpeed: 1,
  defaultFormat: "mp3",
  maxTextLength: 5000,
  model: "kokoro",
  modelVersion: "kokoro-v1.0@v0.8.2"
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function context({ provider } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "vocora-tts-"));
  directories.push(directory);
  const calls = [];
  const ttsProvider = provider ?? {
    async generate(request) {
      calls.push(request);
      return Readable.from([Buffer.from("generated-audio")]);
    }
  };
  const useCase = new SynthesizeSpeech({
    audioCache: new FileTtsAudioCache({ directory }),
    ttsProvider,
    requestOptions
  });
  return { calls, directory, useCase };
}

describe("TTS cache keys", () => {
  const canonical = (input = {}) => createCanonicalTtsRequest({ text: "  Hello\r\nworld!  ", ...input }, requestOptions);

  it("normalizes conservatively and builds deterministic content-addressed keys", () => {
    const first = canonical();
    const second = canonical({ text: "Hello\nworld!" });
    assert.equal(first.text, "Hello\nworld!");
    assert.equal(buildTtsCacheKey(first), buildTtsCacheKey(second));
    assert.equal(
      buildTtsCacheKey(canonical({ text: "caf\u00e9" })),
      buildTtsCacheKey(canonical({ text: "cafe\u0301" }))
    );
  });

  it("changes the key for text, voice, speed, and format changes", () => {
    const baseline = buildTtsCacheKey(canonical());
    assert.notEqual(buildTtsCacheKey(canonical({ text: "Hello world?" })), baseline);
    assert.notEqual(buildTtsCacheKey(canonical({ voice: "af_sky" })), baseline);
    assert.notEqual(buildTtsCacheKey(canonical({ speed: 1.25 })), baseline);
    assert.notEqual(buildTtsCacheKey(canonical({ format: "wav" })), baseline);
    assert.notEqual(buildTtsCacheKey(canonical({ language: "en-gb" })), baseline);
  });

  it("rejects empty, oversized, invalid voice, speed, language, format, and unknown fields", () => {
    const invalidRequests = [
      { text: "   " },
      { text: "x".repeat(5001) },
      { text: "Hello", voice: "not_a_voice" },
      { text: "Hello", speed: 0 },
      { text: "Hello", language: "xx" },
      { text: "Hello", format: "aac" },
      { text: "Hello", internal_url: "http://kokoro:8880" }
    ];
    for (const input of invalidRequests) {
      assert.throws(() => createCanonicalTtsRequest(input, requestOptions), { statusCode: 400 });
    }
  });
});

describe("SynthesizeSpeech", () => {
  it("generates and atomically caches a miss, then serves the same file without calling Kokoro", async () => {
    const { calls, directory, useCase } = await context();
    const first = await useCase.execute({ text: "Hello from Vocora." });
    const second = await useCase.execute({ text: "Hello from Vocora." });

    assert.equal(first.cacheStatus, "miss");
    assert.equal(second.cacheStatus, "hit");
    assert.equal(first.filePath, second.filePath);
    assert.equal(calls.length, 1);
    assert.equal(await readFile(first.filePath, "utf8"), "generated-audio");
    assert.deepEqual(await readdir(directory), [`${first.cacheKey}.mp3`]);
  });

  it("cleans temporary files and leaves no valid cache entry when generation fails", async () => {
    const provider = {
      async generate() {
        return Readable.from((async function* brokenStream() {
          yield Buffer.from("partial");
          throw new AppError(502, "TTS_GENERATION_FAILED", "The speech service could not generate audio.");
        })());
      }
    };
    const { directory, useCase } = await context({ provider });

    await assert.rejects(
      useCase.execute({ text: "This generation fails." }),
      { code: "TTS_GENERATION_FAILED", statusCode: 502 }
    );
    assert.deepEqual(await readdir(directory), []);
  });

  it("reports filesystem failures without leaving temporary cache entries", async () => {
    const { directory, useCase } = await context();
    const canonical = createCanonicalTtsRequest({ text: "The cache is unavailable." }, requestOptions);
    const cacheKey = buildTtsCacheKey(canonical);
    await mkdir(join(directory, `${cacheKey}.mp3`));
    await assert.rejects(
      useCase.execute({ text: "The cache is unavailable." }),
      { code: "TTS_CACHE_WRITE_FAILED", statusCode: 500 }
    );
    assert.ok((await readdir(directory)).every((file) => !file.endsWith(".tmp")));
  });

  it("single-flights concurrent identical misses", async () => {
    let calls = 0;
    let release;
    const started = new Promise((resolve) => { release = resolve; });
    const provider = {
      async generate() {
        calls += 1;
        await started;
        return Readable.from([Buffer.from("shared-audio")]);
      }
    };
    const { useCase } = await context({ provider });
    const first = useCase.execute({ text: "One shared request." });
    const second = useCase.execute({ text: "One shared request." });
    await new Promise((resolve) => setImmediate(resolve));
    release();

    const results = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.equal(results[0].filePath, results[1].filePath);
  });
});
