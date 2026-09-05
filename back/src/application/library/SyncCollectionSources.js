export class SyncCollectionSources {
  constructor({ collectionSourceRepository }) {
    this.collectionSourceRepository = collectionSourceRepository;
  }

  async execute(sources) {
    const results = [];
    for (const source of sources) {
      results.push(await this.collectionSourceRepository.sync(source));
    }

    const activeSlugs = sources.map((source) => source.slug);
    const archiveResult = await this.collectionSourceRepository.archiveMissing(activeSlugs);

    return {
      sourceCount: sources.length,
      changedCount: results.filter((result) => result.changed).length,
      archivedCount: archiveResult.archivedCount,
      archivedSlugs: archiveResult.archivedSlugs,
      results
    };
  }
}
