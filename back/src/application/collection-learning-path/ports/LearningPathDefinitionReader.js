export class LearningPathDefinitionReader {
  async listActiveCollectionRoutes(_options = {}) {
    throw new Error("LearningPathDefinitionReader.listActiveCollectionRoutes must be implemented");
  }

  async findByPublicId(_publicId, _options = {}) {
    throw new Error("LearningPathDefinitionReader.findByPublicId must be implemented");
  }

  async findByRoutePublicId(_publicId, _options = {}) {
    throw new Error("LearningPathDefinitionReader.findByRoutePublicId must be implemented");
  }

  async findActiveByCollectionPublicId(_collectionPublicId, _options = {}) {
    throw new Error("LearningPathDefinitionReader.findActiveByCollectionPublicId must be implemented");
  }
}
