import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig } from "../src/config/loadConfig.js";

describe("TTS configuration", () => {
  it("loads environment-specific provider, cache, defaults, allowlist, and limits", () => {
    const { tts } = loadConfig({
      NODE_ENV: "test",
      KOKORO_TTS_URL: "http://kokoro:8880",
      TTS_CACHE_DIRECTORY: "/tmp/vocora-tts-test",
      TTS_ALLOWED_VOICES: "af_sky, bf_emma,af_sky",
      TTS_DEFAULT_VOICE: "BF_EMMA",
      TTS_DEFAULT_SPEED: "1.25",
      TTS_DEFAULT_FORMAT: "WAV",
      TTS_REQUEST_TIMEOUT_MS: "30000",
      TTS_MAX_TEXT_LENGTH: "2500",
      KOKORO_TTS_MODEL: "kokoro",
      TTS_MODEL_VERSION: "test-model-v2"
    });

    assert.deepEqual(tts, {
      providerUrl: "http://kokoro:8880",
      cacheDirectory: "/tmp/vocora-tts-test",
      allowedVoices: ["af_sky", "bf_emma"],
      defaultVoice: "bf_emma",
      defaultSpeed: 1.25,
      defaultFormat: "wav",
      requestTimeoutMs: 30000,
      maxTextLength: 2500,
      model: "kokoro",
      modelVersion: "test-model-v2"
    });
  });

  it("rejects inconsistent or unsafe TTS configuration", () => {
    const invalid = [
      { TTS_ALLOWED_VOICES: "af_sky", TTS_DEFAULT_VOICE: "af_heart" },
      { TTS_DEFAULT_SPEED: "5" },
      { TTS_DEFAULT_FORMAT: "pcm" },
      { TTS_MAX_TEXT_LENGTH: "2.5" },
      { KOKORO_TTS_URL: "file:///etc/passwd" }
    ];
    for (const override of invalid) {
      assert.throws(() => loadConfig({ NODE_ENV: "test", ...override }), {
        code: "INVALID_CONFIGURATION"
      });
    }
  });
});
