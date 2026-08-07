export class LibraryQueries {
  constructor({ libraryRepository, adminPolicy }) {
    this.libraryRepository = libraryRepository;
    this.adminPolicy = adminPolicy;
  }

  async list(user) {
    const canManage = this.adminPolicy.canManage(user);
    const collections = await this.libraryRepository.listForUser(user.id, { includeManaged: canManage });
    return {
      collections,
      capabilities: { canManage }
    };
  }

  async get(user, collectionId) {
    const canManage = this.adminPolicy.canManage(user);
    const collection = await this.libraryRepository.getForUser(collectionId, user.id, { includeManaged: canManage });
    return {
      collection,
      capabilities: { canManage }
    };
  }

  async vocabularySources(user) {
    return {
      sources: await this.libraryRepository.getVocabularySources(user.id)
    };
  }
}
