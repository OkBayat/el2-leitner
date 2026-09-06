export class LearningPathDefinitionReader {
  async findByPublicId(_publicId) {
    throw new Error("LearningPathDefinitionReader.findByPublicId must be implemented");
  }

  async findActiveByCollectionPublicId(_collectionPublicId) {
    throw new Error("LearningPathDefinitionReader.findActiveByCollectionPublicId must be implemented");
  }
}
