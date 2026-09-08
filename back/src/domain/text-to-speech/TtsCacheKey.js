import { createHash } from "node:crypto";

export const TTS_CACHE_KEY_SCHEMA = "tts:v1";

export function buildTtsCacheKey(request) {
  const keyMaterial = JSON.stringify({
    schema: TTS_CACHE_KEY_SCHEMA,
    normalized_text: request.text,
    voice: request.voice,
    speed: request.speed,
    language: request.language,
    model: request.model,
    model_version: request.modelVersion,
    output_format: request.format,
    provider_normalization: false,
    streaming: true
  });
  return createHash("sha256").update(keyMaterial, "utf8").digest("hex");
}
