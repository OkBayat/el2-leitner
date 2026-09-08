export class ListAvailableLearningPathCollections {
  constructor({ definitionReader, accessReader }) {
    this.definitionReader = definitionReader;
    this.accessReader = accessReader;
  }

  async execute(userId) {
    const routes = await this.definitionReader.listActiveCollectionRoutes();
    const accessible = await Promise.all(routes.map(async (route) => {
      const access = await this.accessReader.getForCollection(userId, route.collectionId);
      return access?.canRead ? route : null;
    }));
    return accessible.filter((route) => route !== null);
  }
}
