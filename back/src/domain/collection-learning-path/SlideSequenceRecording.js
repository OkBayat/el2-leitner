import { ValidationError } from "../errors.js";

export const SLIDE_SEQUENCE_RECORDING_MAX_BYTES = 2_000_000;
export const SLIDE_SEQUENCE_RECORDING_MIN_BYTES = 256;

const SUPPORTED_MIME_TYPES = new Set([
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
]);

function startsWith(bytes, signature, offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function hasExpectedContainer(bytes, mimeType) {
  if (mimeType === "audio/webm") return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (mimeType === "audio/ogg") return startsWith(bytes, [0x4f, 0x67, 0x67, 0x53]);
  if (mimeType === "audio/wav") {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8);
  }
  return mimeType === "audio/mp4" && startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4);
}

export function validateSlideSequenceRecording(value) {
  const mimeType = String(value?.mimeType ?? "").split(";", 1)[0].trim().toLocaleLowerCase("en");
  const bytes = value?.bytes;
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new ValidationError(
      "INVALID_SLIDE_SEQUENCE_RECORDING_TYPE",
      "The speaking recording must use a supported audio format.",
    );
  }
  if (!(bytes instanceof Uint8Array)
    || bytes.byteLength < SLIDE_SEQUENCE_RECORDING_MIN_BYTES
    || bytes.byteLength > SLIDE_SEQUENCE_RECORDING_MAX_BYTES
    || !hasExpectedContainer(bytes, mimeType)) {
    throw new ValidationError(
      "INVALID_SLIDE_SEQUENCE_RECORDING",
      "The speaking recording is empty, too large, or not valid audio data.",
    );
  }
  return {
    mimeType,
    bytes,
    byteSize: bytes.byteLength,
  };
}
