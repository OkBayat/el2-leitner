import { buildTtsCacheKey } from "../../domain/text-to-speech/TtsCacheKey.js";
import {
  createCanonicalTtsRequest,
  TTS_FORMAT_CONTENT_TYPES
} from "../../domain/text-to-speech/TtsRequest.js";

export class SynthesizeSpeech {
  constructor({ audioCache, ttsProvider, requestOptions }) {
    this.audioCache = audioCache;
    this.ttsProvider = ttsProvider;
    this.requestOptions = requestOptions;
    this.inFlight = new Map();
  }

  async execute(rawRequest) {
    const request = createCanonicalTtsRequest(rawRequest, this.requestOptions);
    const cacheKey = buildTtsCacheKey(request);
    const cachedPath = await this.audioCache.find(cacheKey, request.format);
    if (cachedPath) return this.#result(request, cacheKey, cachedPath, "hit");

    let generation = this.inFlight.get(cacheKey);
    if (!generation) {
      generation = this.#generate(cacheKey, request);
      this.inFlight.set(cacheKey, generation);
      generation.finally(() => {
        if (this.inFlight.get(cacheKey) === generation) this.inFlight.delete(cacheKey);
      }).catch(() => {});
    }

    const filePath = await generation;
    return this.#result(request, cacheKey, filePath, "miss");
  }

  async #generate(cacheKey, request) {
    const audioStream = await this.ttsProvider.generate(request);
    return this.audioCache.store(cacheKey, request.format, audioStream);
  }

  #result(request, cacheKey, filePath, cacheStatus) {
    return {
      cacheKey,
      cacheStatus,
      contentType: TTS_FORMAT_CONTENT_TYPES[request.format],
      filePath,
      format: request.format
    };
  }
}
