import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, it } from "node:test";

import { KokoroTtsClient } from "../src/infrastructure/text-to-speech/KokoroTtsClient.js";

const request = {
  text: "Hello.",
  voice: "af_heart",
  speed: 1,
  language: "auto",
  model: "kokoro",
  format: "mp3"
};

describe("KokoroTtsClient", () => {
  it("uses the private OpenAI-compatible speech contract without forwarding internal errors", async () => {
    const calls = [];
    const client = new KokoroTtsClient({
      baseUrl: "http://kokoro:8880",
      timeoutMs: 1000,
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(Readable.toWeb(Readable.from([Buffer.from("audio")])), { status: 200 });
      }
    });
    const audio = await client.generate(request);
    assert.equal((await audio.toArray()).join(""), "audio");
    assert.equal(calls[0].url, "http://kokoro:8880/v1/audio/speech");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      model: "kokoro",
      input: "Hello.",
      voice: "af_heart",
      speed: 1,
      response_format: "mp3",
      stream: true,
      normalization_options: { normalize: false }
    });
    assert.equal(calls[0].options.redirect, "error");
  });

  it("maps timeout, unavailable, and failed generation to safe application errors", async () => {
    const timeout = new KokoroTtsClient({
      baseUrl: "http://kokoro:8880",
      timeoutMs: 1000,
      fetchImpl: async () => { throw new DOMException("secret", "TimeoutError"); }
    });
    await assert.rejects(timeout.generate(request), { code: "TTS_PROVIDER_TIMEOUT", statusCode: 504 });

    const unavailable = new KokoroTtsClient({
      baseUrl: "http://kokoro:8880",
      timeoutMs: 1000,
      fetchImpl: async () => { throw new TypeError("private network address"); }
    });
    await assert.rejects(unavailable.generate(request), { code: "TTS_PROVIDER_UNAVAILABLE", statusCode: 503 });

    const failed = new KokoroTtsClient({
      baseUrl: "http://kokoro:8880",
      timeoutMs: 1000,
      fetchImpl: async () => new Response("private provider trace", { status: 500 })
    });
    await assert.rejects(failed.generate(request), (error) =>
      error.code === "TTS_GENERATION_FAILED" && !error.message.includes("private provider trace"));
  });

  it("maps the public language name to Kokoro's language code", async () => {
    let body;
    const client = new KokoroTtsClient({
      baseUrl: "http://kokoro:8880",
      timeoutMs: 1000,
      fetchImpl: async (_url, options) => {
        body = JSON.parse(options.body);
        return new Response(Readable.toWeb(Readable.from([Buffer.from("audio")])), { status: 200 });
      }
    });
    await client.generate({ ...request, language: "en-gb" });
    assert.equal(body.lang_code, "b");
  });
});
