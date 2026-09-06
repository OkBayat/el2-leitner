import { describe, expect, it } from 'vitest';
import { buildDailyPath, listeningRingSegments, type TimelineDay } from './daily-path';

const today = '2026-09-06';

function listeningStep(day: TimelineDay, goal?: number) {
  return buildDailyPath([day], today, goal)
    .find(item => item.day === today)!
    .steps.find(step => step.id === 'listening')!;
}

describe('Home listening daily goal visibility', () => {
  it('renders the default three-part ring even when an older timeline response omits listeningProgress', () => {
    const step = listeningStep({ day: today, activities: [], boxOnePracticed: false });

    expect(step.listeningProgress).toEqual({ completed: 0, total: 3 });
    expect(listeningRingSegments(step.listeningProgress)).toEqual([
      { index: 0, state: 'pending' },
      { index: 1, state: 'pending' },
      { index: 2, state: 'pending' },
    ]);
  });

  it('uses the learner setting immediately and keeps one legacy listening completion visible', () => {
    const step = listeningStep({ day: today, activities: ['listening'], boxOnePracticed: false }, 4);

    expect(step.listeningProgress).toEqual({ completed: 1, total: 4 });
    expect(listeningRingSegments(step.listeningProgress).map(segment => segment.state))
      .toEqual(['complete', 'pending', 'pending', 'pending']);
  });

  it('preserves server attempt counts and turns attempts beyond the goal into Legendary segments', () => {
    const step = listeningStep({
      day: today,
      activities: ['listening'],
      boxOnePracticed: false,
      listeningProgress: { completed: 4, total: 3 },
    });

    expect(step.legendary).toBe(true);
    expect(listeningRingSegments(step.listeningProgress).map(segment => segment.state))
      .toEqual(['complete', 'complete', 'complete', 'legendary']);
  });

  it('lets the saved setting override a stale timeline goal without losing completed attempts', () => {
    const step = listeningStep({
      day: today,
      activities: ['listening'],
      boxOnePracticed: false,
      listeningProgress: { completed: 2, total: 3 },
    }, 4);

    expect(step.listeningProgress).toEqual({ completed: 2, total: 4 });
    expect(step.status).toBe('in-progress');
  });
});
