export class GetLearningState {
  constructor({ learningStateRepository, learningBootstrapRepository = learningStateRepository }) {
    this.learningStateRepository = learningStateRepository;
    this.learningBootstrapRepository = learningBootstrapRepository;
  }

  async execute(userId, input = {}) {
    const repository = input.view === "full"
      ? this.learningStateRepository
      : this.learningBootstrapRepository;
    return repository.findByUserId(userId);
  }
}
