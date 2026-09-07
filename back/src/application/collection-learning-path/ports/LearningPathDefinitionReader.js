export class LearningPathDefinitionReader {
  async listActiveCollectionPublicIds(_options = {}) {
    throw new Error("LearningPathDefinitionReader.listActiveCollectionPublicIds must be implemented");
  }

  async findByPublicId(_publicId, _options = {}) {
    throw new Error("LearningPathDefinitionReader.findByPublicId must be implemented");
  }

  async findActiveByCollectionPublicId(_collectionPublicId, _options = {}) {
    throw new Error("LearningPathDefinitionReader.findActiveByCollectionPublicId must be implemented");
  }
}
