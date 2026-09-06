import { describe, expect, it } from 'vitest';
import { buildDailyPath, type TimelineDay } from './daily-path';

describe('daily home path', () => {
  const today = '2026-09-06';
  it('keeps exactly six ordered nodes and only colors recorded activities', () => {
    const data: TimelineDay[] = [{ day: today, activities: ['listening'], boxOnePracticed: false }];
    const days = buildDailyPath(data, today);
    expect(days[0].steps.map(step => step.id)).toEqual(['vocabulary', 'listening', 'shadowing', 'reading', 'reserved-5', 'reserved-6']);
    expect(days[0].steps.map(step => step.status)).toEqual(['available', 'practiced', 'available', 'planned', 'planned', 'planned']);
    expect(days[0].steps.filter(step => step.current).map(step => step.id)).toEqual(['vocabulary']);
  });
  it('keeps a partially completed vocabulary step current and reports its percentage', () => {
    const [day] = buildDailyPath([{
      day: today,
      activities: ['vocabulary'],
      boxOnePracticed: false,
      vocabularyProgress: { completed: 5, total: 10 },
    }], today);
    expect(day.steps[0]).toMatchObject({ id: 'vocabulary', status: 'in-progress', current: true, progress: 50 });
    expect(day.steps[1]).toMatchObject({ id: 'listening', status: 'available', current: false, progress: null });
  });
  it('advances the current marker only after the vocabulary workload reaches 100 percent', () => {
    const [day] = buildDailyPath([{
      day: today,
      activities: ['vocabulary'],
      boxOnePracticed: false,
      vocabularyProgress: { completed: 10, total: 10 },
    }], today);
    expect(day.steps[0]).toMatchObject({ status: 'practiced', current: false, progress: 100 });
    expect(day.steps[1]).toMatchObject({ status: 'available', current: true });
  });
  it('preserves colored history and leaves missed historical tasks gray', () => {
    const days = buildDailyPath([
      { day: '2026-09-05', activities: ['vocabulary', 'shadowing'], boxOnePracticed: true },
      { day: today, activities: [], boxOnePracticed: false },
    ], today);
    expect(days[0].steps.map(step => step.status)).toEqual(['practiced', 'available', 'practiced', 'planned', 'planned', 'planned']);
    expect(days[0].steps.some(step => step.current)).toBe(false);
    expect(days[0].boxOnePracticed).toBe(true);
  });
  it('always generates two gray future days and ignores any future completion payload', () => {
    const days = buildDailyPath([
      { day: today, activities: [], boxOnePracticed: false },
      { day: '2026-09-07', activities: ['vocabulary', 'listening', 'shadowing'], boxOnePracticed: true },
    ], today);
    const future = days.filter(day => day.future);
    expect(future.map(day => day.day)).toEqual(['2026-09-07', '2026-09-08']);
    expect(future.every(day => day.steps.every(step => step.status === 'upcoming'))).toBe(true);
    expect(future.every(day => !day.boxOnePracticed)).toBe(true);
  });
  it('has no start marker when every available activity has been practised', () => {
    const [day] = buildDailyPath([{ day: today, activities: ['vocabulary', 'listening', 'shadowing'], boxOnePracticed: false }], today);
    expect(day.steps.some(step => step.current)).toBe(false);
    expect(day.steps[3].status).toBe('planned');
  });
  it('uses only real destinations and preserves Box 1 as a separate practice entry', () => {
    const [day] = buildDailyPath([{ day: today, activities: [], boxOnePracticed: true }], today);
    expect(day.steps.slice(0, 3).map(step => step.route)).toEqual(['/review', '/bbc-6-minute-english', '/shadowing']);
    expect(day.steps.slice(3).every(step => step.route === null)).toBe(true);
    expect(day.steps[0].status).toBe('available');
  });
  it('handles year boundaries and never fabricates history before the response', () => {
    const days = buildDailyPath([{ day: '2026-12-31', activities: [], boxOnePracticed: false }], '2026-12-31');
    expect(days.map(day => day.day)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
    expect(buildDailyPath([], '')).toEqual([]);
  });
});
