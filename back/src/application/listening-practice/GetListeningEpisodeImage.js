import { NotFoundError, ValidationError } from "../../domain/errors.js";
import { BBC_SIX_MINUTE_ENGLISH } from "../../domain/listening-practice/ListeningProviders.js";

export class GetListeningEpisodeImage {
  constructor({ listeningPracticeRepository }) { this.repository = listeningPracticeRepository; }

  async execute(slug) {
    if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,159}$/u.test(slug)) {
      throw new ValidationError("INVALID_LISTENING_LESSON", "A valid listening lesson slug is required.");
    }
    const image = await this.repository.findPublishedImageBySlug(BBC_SIX_MINUTE_ENGLISH, slug);
    if (!/^cover\.(?:jpg|jpeg|png|webp)$/u.test(image.imageFile)
      || !/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(image.assetDirectory)) {
      throw new NotFoundError("LISTENING_IMAGE_NOT_FOUND", "Listening episode image was not found.");
    }
    return { fileName: image.imageFile, assetDirectory: image.assetDirectory };
  }
}
