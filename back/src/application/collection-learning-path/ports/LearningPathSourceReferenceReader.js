export class LearningPathSourceReferenceReader {
  async findCollectionByPublicId(_publicId, _options = {}) {
    throw new Error("LearningPathSourceReferenceReader.findCollectionByPublicId must be implemented");
  }

  async findCollectionSection(_reference, _options = {}) {
    throw new Error("LearningPathSourceReferenceReader.findCollectionSection must be implemented");
  }
}
