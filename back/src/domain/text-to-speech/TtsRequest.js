import { ValidationError } from "../errors.js";

export const TTS_FORMAT_CONTENT_TYPES = Object.freeze({
  flac: "audio/flac",
  mp3: "audio/mpeg",
  opus: "audio/opus",
  wav: "audio/wav"
});

export const TTS_LANGUAGE_CODES = Object.freeze({
  "en-gb": "b",
  "en-us": "a",
  es: "e",
  "fr-fr": "f",
  hi: "h",
  it: "i",
  ja: "j",
  "pt-br": "p",
  zh: "z"
});

const REQUEST_FIELDS = new Set(["format", "language", "speed", "text", "voice"]);

function normalizeText(value, maxTextLength) {
  if (typeof value !== "string") {
    throw new ValidationError("INVALID_TTS_TEXT", "TTS text must be a string.");
  }
  const normalized = value.normalize("NFC").replace(/\r\n?/gu, "\n").trim();
  if (!normalized) {
    throw new ValidationError("INVALID_TTS_TEXT", "TTS text must not be empty.");
  }
  if (normalized.length > maxTextLength) {
    throw new ValidationError(
      "TTS_TEXT_TOO_LARGE",
      `TTS text must not exceed ${maxTextLength} characters.`
    );
  }
  return normalized;
}

function canonicalVoice(value, { allowedVoices, defaultVoice }) {
  const voice = value === undefined ? defaultVoice : value;
  if (typeof voice !== "string" || !allowedVoices.includes(voice.trim().toLowerCase())) {
    throw new ValidationError("INVALID_TTS_VOICE", "The requested TTS voice is not supported.");
  }
  return voice.trim().toLowerCase();
}

function canonicalSpeed(value, defaultSpeed) {
  const speed = value === undefined ? defaultSpeed : value;
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0.25 || speed > 4) {
    throw new ValidationError("INVALID_TTS_SPEED", "TTS speed must be a number from 0.25 to 4.");
  }
  return speed;
}

function canonicalFormat(value, defaultFormat) {
  const format = value === undefined ? defaultFormat : value;
  if (typeof format !== "string" || !Object.hasOwn(TTS_FORMAT_CONTENT_TYPES, format.toLowerCase())) {
    throw new ValidationError("INVALID_TTS_FORMAT", "The requested TTS output format is not supported.");
  }
  return format.toLowerCase();
}

function canonicalLanguage(value) {
  if (value === undefined || value === null) return "auto";
  if (typeof value === "string" && value.toLowerCase() === "auto") return "auto";
  if (typeof value !== "string" || !Object.hasOwn(TTS_LANGUAGE_CODES, value.toLowerCase())) {
    throw new ValidationError("INVALID_TTS_LANGUAGE", "The requested TTS language is not supported.");
  }
  return value.toLowerCase();
}

export function createCanonicalTtsRequest(rawRequest, options) {
  if (!rawRequest || typeof rawRequest !== "object" || Array.isArray(rawRequest)) {
    throw new ValidationError("INVALID_TTS_REQUEST", "A TTS request object is required.");
  }
  if (Object.keys(rawRequest).some((field) => !REQUEST_FIELDS.has(field))) {
    throw new ValidationError("INVALID_TTS_REQUEST", "The TTS request contains an unsupported field.");
  }

  return Object.freeze({
    text: normalizeText(rawRequest.text, options.maxTextLength),
    voice: canonicalVoice(rawRequest.voice, options),
    speed: canonicalSpeed(rawRequest.speed, options.defaultSpeed),
    language: canonicalLanguage(rawRequest.language),
    model: options.model,
    modelVersion: options.modelVersion,
    format: canonicalFormat(rawRequest.format, options.defaultFormat)
  });
}
