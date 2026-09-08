import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { AppError } from "../../domain/errors.js";

const SAFE_CACHE_KEY = /^[a-f0-9]{64}$/u;
const SAFE_FORMAT = /^(?:flac|mp3|opus|wav)$/u;

export class FileTtsAudioCache {
  constructor({ directory }) {
    this.directory = path.resolve(directory);
  }

  filePath(cacheKey, format) {
    if (!SAFE_CACHE_KEY.test(cacheKey) || !SAFE_FORMAT.test(format)) {
      throw new AppError(500, "TTS_CACHE_KEY_INVALID", "The TTS cache key is invalid.");
    }
    return path.join(this.directory, `${cacheKey}.${format}`);
  }

  async find(cacheKey, format) {
    const filePath = this.filePath(cacheKey, format);
    try {
      const fileStats = await stat(filePath);
      return fileStats.isFile() ? filePath : null;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw new AppError(500, "TTS_CACHE_READ_FAILED", "The TTS audio cache could not be read.");
    }
  }

  async store(cacheKey, format, audioStream) {
    const finalPath = this.filePath(cacheKey, format);
    const temporaryPath = path.join(this.directory, `.${cacheKey}.${randomUUID()}.tmp`);
    try {
      await mkdir(this.directory, { recursive: true });
      await pipeline(audioStream, createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }));
      if ((await stat(temporaryPath)).size === 0) {
        throw new AppError(502, "TTS_GENERATION_FAILED", "The speech service returned empty audio.");
      }
      await rename(temporaryPath, finalPath);
      return finalPath;
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => {});
      if (error instanceof AppError) throw error;
      throw new AppError(500, "TTS_CACHE_WRITE_FAILED", "Generated TTS audio could not be cached.");
    }
  }
}
