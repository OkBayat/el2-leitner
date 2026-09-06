import {
  ensureLearningPathReadAccess,
  loadPathByCollection,
  projectedPathForUser,
} from "../learningPathSupport.js";

export class GetCollectionLearningPath {
  constructor({ definitionReader, progressReader, accessReader }) {
    this.definitionReader = definitionReader;
    this.progressReader = progressReader;
    this.accessReader = accessReader;
  }

  async execute(userId, collectionId) {
    const path = await loadPathByCollection(this.definitionReader, collectionId);
    await ensureLearningPathReadAccess(this.accessReader, userId, path);
    const { projected } = await projectedPathForUser({
      progressReader: this.progressReader,
      userId,
      path,
    });
    return projected;
  }
}
