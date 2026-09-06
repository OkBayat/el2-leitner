import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLearningTimeline, timelineQuery } from '../src/domain/learning/LearningTimeline.js';
import {
  DEFAULT_DAILY_LISTENING_GOAL,
  MAX_DAILY_LISTENING_GOAL,
  normalizeDailyListeningGoal,
} from '../src/infrastructure/persistence/mysql/MySqlListeningGoalLearningStateRepository.js';

function evidence({ listening = [], goal = DEFAULT_DAILY_LISTENING_GOAL } = {}) {
  return {
    reviews: [],
    practice: [],
    listening,
    legacy: [],
    first: {},
    settings: { dailyListeningGoal: goal },
  };
}

test('today counts every completed listening attempt and keeps attempts beyond the goal', () => {
  const range = timelineQuery({ timeZone: 'UTC', limit: 1 }, new Date('2026-09-06T20:00:00Z'));
  const data = evidence({
    goal: 3,
    listening: [
      '2026-09-06T08:00:00Z',
      '2026-09-06T10:00:00Z',
      '2026-09-06T12:00:00Z',
      '2026-09-06T14:00:00Z',
    ].map(at => ({ at: Date.parse(at) })),
  });

  const result = buildLearningTimeline(range, data);
  assert.deepEqual(result.days[0].listeningProgress, { completed: 4, total: 3 });
  assert.deepEqual(result.days[0].activities, ['listening']);
});

test('listening progress respects the learner timezone instead of the server date', () => {
  const range = timelineQuery({ timeZone: 'Asia/Tehran', limit: 1 }, new Date('2026-09-05T21:30:00Z'));
  const data = evidence({
    goal: 4,
    listening: [
      { at: Date.parse('2026-09-05T19:00:00Z') },
      { at: Date.parse('2026-09-05T21:00:00Z') },
      { at: Date.parse('2026-09-05T22:30:00Z') },
    ],
  });

  const result = buildLearningTimeline(range, data);
  assert.equal(result.today, '2026-09-06');
  assert.deepEqual(result.days[0].listeningProgress, { completed: 2, total: 4 });
});

test('daily listening goal defaults to three and is constrained to a readable supported range', () => {
  assert.equal(normalizeDailyListeningGoal(undefined), DEFAULT_DAILY_LISTENING_GOAL);
  assert.equal(normalizeDailyListeningGoal('3'), 3);
  assert.equal(normalizeDailyListeningGoal(0), 1);
  assert.equal(normalizeDailyListeningGoal(99), MAX_DAILY_LISTENING_GOAL);
  assert.equal(normalizeDailyListeningGoal(2.5), DEFAULT_DAILY_LISTENING_GOAL);
});
