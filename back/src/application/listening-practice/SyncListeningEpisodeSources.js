export class SyncListeningEpisodeSources {
  constructor({ listeningEpisodeSourceRepository }) {
    this.repository = listeningEpisodeSourceRepository;
  }

  async execute(sources) {
    if (!Array.isArray(sources) || !sources.length) throw new Error("No validated episode sources supplied.");
    return this.repository.sync(sources);
  }
}
