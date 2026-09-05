import { ValidationError } from "../../domain/errors.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../domain/listening-practice/ListeningProviders.js";

export class GetListeningEpisodeVocabulary {
  constructor({ listeningVocabularyRepository }) { this.repository = listeningVocabularyRepository; }

  async execute(userId, slug) {
    if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,159}$/u.test(slug)) {
      throw new ValidationError("INVALID_LISTENING_LESSON", "A valid listening lesson slug is required.");
    }
    return this.repository.findForEpisode(userId, BBC_SIX_MINUTE_ENGLISH, slug);
  }
}
