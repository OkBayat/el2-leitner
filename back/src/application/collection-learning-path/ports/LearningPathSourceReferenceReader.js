export class LearningPathSourceReferenceReader {
  async resolveCollection(_reference, _options = {}) {
    throw new Error("LearningPathSourceReferenceReader.resolveCollection must be implemented");
  }

  async findCollectionSection(_reference, _options = {}) {
    throw new Error("LearningPathSourceReferenceReader.findCollectionSection must be implemented");
  }
}
