import { buildLearningTimeline, timelineQuery } from '../../domain/learning/LearningTimeline.js';

export class GetLearningTimeline {
  constructor({ timelineRepository, now = () => new Date() }) {
    this.timelineRepository = timelineRepository;
    this.now = now;
  }

  async execute(userId, input = {}) {
    const range = timelineQuery(input, this.now());
    const data = await this.timelineRepository.read(userId, { from: range.from, to: range.to, today: range.today });
    return buildLearningTimeline(range, data);
  }
}
