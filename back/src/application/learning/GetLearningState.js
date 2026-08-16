export class GetLearningState {
  constructor({ learningStateRepository, learningBootstrapRepository = learningStateRepository }) {
    this.learningStateRepository = learningStateRepository;
    this.learningBootstrapRepository = learningBootstrapRepository;
  }

  async execute(userId, input = {}) {
    const repository = input.view === "bootstrap"
      ? this.learningBootstrapRepository
      : this.learningStateRepository;
    return repository.findByUserId(userId);
  }
}
