export class SyncCollectionSources {
  constructor({ collectionSourceRepository }) {
    this.collectionSourceRepository = collectionSourceRepository;
  }

  async execute(sources) {
    const results = [];
    for (const source of sources) {
      results.push(await this.collectionSourceRepository.sync(source));
    }
    return {
      sourceCount: sources.length,
      changedCount: results.filter((result) => result.changed).length,
      results
    };
  }
}
