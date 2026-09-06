import assert from 'node:assert/strict';
import test from 'node:test';
import { GetLearningTimeline } from '../src/application/learning/GetLearningTimeline.js';

const empty = () => ({ reviews: [], practice: [], listening: [], legacy: [], first: {} });
function subject(data = empty(), now = '2026-09-06T10:00:00Z') {
  const calls = [];
  const useCase = new GetLearningTimeline({
    timelineRepository: { read: async (...args) => { calls.push(args); return data; } },
    now: () => new Date(now),
  });
  return { useCase, calls };
}

test('new learners see today without invented practice or past days', async () => {
  const { useCase } = subject();
  assert.deepEqual(await useCase.execute(17), {
    today: '2026-09-06', days: [{ day: '2026-09-06', activities: [], boxOnePracticed: false }],
    nextBefore: null, limitedHistory: false,
  });
});

test('each activity uses its own evidence; wrong answers and repeated practice still count', async () => {
  const data = empty();
  data.first.reviewDay = '2026-09-04';
  data.reviews = [
    { day: '2026-09-04', activity: 'vocabulary' },
    { day: '2026-09-06', activity: 'box1' },
    { day: '2026-09-06', activity: 'vocabulary' },
    { day: '2026-09-06', activity: 'vocabulary' },
    { day: '2026-09-07', activity: 'vocabulary' },
  ];
  data.practice = [{ day: '2026-09-06', activity: 'shadowing' }];
  data.listening = [{ at: Date.parse('2026-09-05T22:00:00Z') }];
  const { useCase, calls } = subject(data);
  const result = await useCase.execute(17, { timeZone: 'Asia/Tehran', limit: '3' });
  assert.equal(calls[0][0], 17);
  assert.deepEqual(result.days, [
    { day: '2026-09-04', activities: ['vocabulary'], boxOnePracticed: false },
    { day: '2026-09-05', activities: [], boxOnePracticed: false },
    { day: '2026-09-06', activities: ['vocabulary', 'listening', 'shadowing'], boxOnePracticed: true },
  ]);
});

test('an exclusive cursor keeps chronological history without a retention cutoff', async () => {
  const data = empty(); data.first.reviewDay = '2020-02-28';
  const { useCase } = subject(data);
  const first = await useCase.execute(1, { before: '2020-03-02', limit: '3' });
  assert.deepEqual(first.days.map(day => day.day), ['2020-02-28', '2020-02-29', '2020-03-01']);
  assert.equal(first.nextBefore, null);
  const page = await useCase.execute(1, { limit: '2' });
  assert.equal(page.nextBefore, '2026-09-05');
  const older = await useCase.execute(1, { before: page.nextBefore, limit: '2' });
  assert.deepEqual(older.days.map(day => day.day), ['2026-09-03', '2026-09-04']);
});

test('today follows the learner timezone, not the server UTC date', async () => {
  const { useCase } = subject(empty(), '2026-09-05T21:00:00Z');
  assert.equal((await useCase.execute(1, { timeZone: 'Asia/Tehran' })).today, '2026-09-06');
  assert.equal((await useCase.execute(1, { timeZone: 'America/Los_Angeles' })).today, '2026-09-05');
});

test('listening dates use historical DST and include the entire local day', async () => {
  const data = empty(); data.first.listeningAt = Date.parse('2026-03-08T07:30:00Z');
  data.listening = ['2026-03-08T07:30:00Z', '2026-03-08T09:30:00Z', '2026-03-09T06:30:00Z']
    .map(at => ({ at: Date.parse(at) }));
  const { useCase } = subject(data, '2026-03-09T12:00:00Z');
  const result = await useCase.execute(1, { timeZone: 'America/Los_Angeles', limit: '3' });
  assert.deepEqual(result.days.map(day => [day.day, day.activities]), [
    ['2026-03-07', ['listening']], ['2026-03-08', ['listening']], ['2026-03-09', []],
  ]);
});

test('legacy single-day practice is retained but missing multi-day detail is never invented', async () => {
  const data = empty(); data.first.legacyAt = Date.parse('2026-09-04T08:00:00Z');
  data.legacy = [
    { activity: 'shadowing', startedAt: Date.parse('2026-09-04T08:00:00Z'), lastAt: Date.parse('2026-09-04T09:00:00Z') },
    { activity: 'shadowing', startedAt: Date.parse('2026-09-05T08:00:00Z'), lastAt: Date.parse('2026-09-06T09:00:00Z') },
  ];
  const { useCase } = subject(data);
  const result = await useCase.execute(1);
  assert.deepEqual(result.days.map(day => day.activities), [['shadowing'], [], []]);
  assert.equal(result.limitedHistory, true);
});

test('per-day shadowing evidence survives a session crossing midnight', async () => {
  const data = empty(); data.first.practiceDay = '2026-09-05';
  data.practice = [
    { day: '2026-09-05', activity: 'shadowing' }, { day: '2026-09-06', activity: 'shadowing' },
  ];
  const { useCase } = subject(data);
  assert.deepEqual((await useCase.execute(1)).days.map(day => day.activities), [['shadowing'], ['shadowing']]);
});

for (const query of [
  { before: '2026-02-30' }, { before: '2027-01-01' }, { before: ['2026-09-05'] },
  { limit: '0' }, { limit: '15' }, { limit: '1.5' }, { limit: [] },
  { timeZone: 'not/a/timezone' }, { timeZone: ['UTC'] },
]) {
  test(`invalid timeline query is rejected before persistence: ${JSON.stringify(query)}`, async () => {
    const { useCase, calls } = subject();
    await assert.rejects(useCase.execute(1, query), { statusCode: 400 });
    assert.equal(calls.length, 0);
  });
}
