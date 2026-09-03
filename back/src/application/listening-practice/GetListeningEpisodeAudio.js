import { NotFoundError, ValidationError } from "../../domain/errors.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../domain/listening-practice/ListeningProviders.js";

const SAFE_AUDIO_FILE = /^[a-z0-9][a-z0-9._-]*\.mp3$/u;

function lessonSlug(value) {
  const slug = typeof value === "string" ? value.trim() : "";
  if (!slug || slug.length > 160) {
    throw new ValidationError("INVALID_LISTENING_LESSON", "A valid listening lesson slug is required.");
  }
  return slug;
}

export class GetListeningEpisodeAudio {
  constructor({ listeningPracticeRepository }) {
    this.listeningPracticeRepository = listeningPracticeRepository;
  }

  async execute(rawSlug) {
    const audio = await this.listeningPracticeRepository.findPublishedAudioBySlug(
      BBC_SIX_MINUTE_ENGLISH,
      lessonSlug(rawSlug)
    );
    const fileName = typeof audio?.audioFile === "string" ? audio.audioFile.trim() : "";
    if (!SAFE_AUDIO_FILE.test(fileName)) {
      throw new NotFoundError("LISTENING_AUDIO_NOT_FOUND", "Listening episode audio was not found.");
    }
    return { fileName };
  }
}
