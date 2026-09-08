export class ListAvailableLearningPathCollections {
  constructor({ catalogReader }) {
    this.catalogReader = catalogReader;
  }

  async execute(userId) {
    return this.catalogReader.listAvailableForUser(userId);
  }
}
