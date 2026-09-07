export class ListAvailableLearningPathCollections {
  constructor({ definitionReader, accessReader }) {
    this.definitionReader = definitionReader;
    this.accessReader = accessReader;
  }

  async execute(userId) {
    const collectionIds = await this.definitionReader.listActiveCollectionPublicIds();
    const accessible = await Promise.all(collectionIds.map(async (id) => {
      const access = await this.accessReader.getForCollection(userId, id);
      return access?.canRead ? id : null;
    }));
    return accessible.filter((id) => id !== null);
  }
}
