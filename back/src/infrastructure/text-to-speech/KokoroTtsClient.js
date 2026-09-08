import { Readable } from "node:stream";

import { AppError } from "../../domain/errors.js";
import { TTS_LANGUAGE_CODES } from "../../domain/text-to-speech/TtsRequest.js";

function providerError(error) {
  if (error instanceof AppError) return error;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return new AppError(504, "TTS_PROVIDER_TIMEOUT", "Speech generation timed out. Please try again.");
  }
  return new AppError(503, "TTS_PROVIDER_UNAVAILABLE", "Speech generation is temporarily unavailable.");
}

export class KokoroTtsClient {
  constructor({ baseUrl = "", timeoutMs, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/u, "");
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    if (this.baseUrl && !/^https?:\/\//u.test(this.baseUrl)) {
      throw new Error("KOKORO_TTS_URL must be an HTTP(S) URL.");
    }
  }

  async generate(request) {
    if (!this.baseUrl) {
      throw new AppError(503, "TTS_PROVIDER_UNAVAILABLE", "Speech generation is not configured.");
    }

    const payload = {
      model: request.model,
      input: request.text,
      voice: request.voice,
      speed: request.speed,
      response_format: request.format,
      stream: true,
      normalization_options: { normalize: false },
      ...(request.language === "auto" ? {} : { lang_code: TTS_LANGUAGE_CODES[request.language] })
    };

    let response;
    try {
      response = await this.fetch(`${this.baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      throw providerError(error);
    }

    if (!response.ok || !response.body) {
      throw new AppError(502, "TTS_GENERATION_FAILED", "The speech service could not generate audio.");
    }

    const providerStream = Readable.fromWeb(response.body);
    return Readable.from((async function* safeProviderStream() {
      try {
        for await (const chunk of providerStream) yield chunk;
      } catch (error) {
        throw providerError(error);
      }
    })());
  }
}
