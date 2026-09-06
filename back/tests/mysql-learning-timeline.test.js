import assert from 'node:assert/strict';
import test from 'node:test';
import { MySqlLearningTimelineRepository } from '../src/infrastructure/persistence/mysql/MySqlLearningTimelineRepository.js';

test('timeline reads are bounded, parameterized, user-scoped, and include every review-event mode', async () => {
  const calls = [];
  const pool = { execute: async (sql, values) => { calls.push({ sql, values }); return [[]]; } };
  const result = await new MySqlLearningTimelineRepository(pool).read(42, { from: '2026-09-01', to: '2026-09-06' });
  assert.equal(calls.length, 7);
  for (const { sql, values } of calls) {
    assert.match(sql, /user_id = \?/u);
    assert.equal(values[0], 42);
    assert.doesNotMatch(sql, /answers_json|result_json|term_snapshot|user_daily_stats|INSERT|UPDATE|DELETE/u);
  }
  assert.deepEqual(calls[0].values, [42, '2026-09-01', '2026-09-06']);
  assert.match(calls[0].sql, /FROM review_events/u);
  assert.match(calls[0].sql, /mode = 'box1' THEN 'box1'/u);
  assert.doesNotMatch(calls[0].sql, /mode IN/u);
  assert.match(calls[1].sql, /practice_session_days/u);
  assert.match(calls[2].sql, /status = 'completed'/u);
  assert.deepEqual(calls[2].values, [42, Date.parse('2026-08-31T00:00:00Z') / 1000, Date.parse('2026-09-08T00:00:00Z') / 1000]);
  assert.match(calls[3].sql, /completed_count > 0/u);
  assert.match(calls[3].sql, /NOT EXISTS/u);
  assert.deepEqual(calls[4].values, [42, 42, 42, 42]);
  assert.match(calls[4].sql, /MIN\(local_day\).*FROM review_events/su);
  assert.doesNotMatch(calls[4].sql, /review_events[\s\S]*mode IN \('review', 'new', 'box1'\)/u);
  assert.match(calls[5].sql, /COUNT\(DISTINCT re\.vocabulary_entry_id\)/u);
  assert.match(calls[5].sql, /uvp\.due_date <= \?/u);
  assert.match(calls[5].sql, /NOT EXISTS/u);
  assert.match(calls[5].sql, /COALESCE\(re\.mode, 'review'\) <> 'box1'/u);
  assert.deepEqual(calls[5].values, [42, '2026-09-06', 42, '2026-09-06', '2026-09-06', '2026-09-06']);
  assert.match(calls[6].sql, /daily_listening_goal AS dailyListeningGoal/u);
  assert.deepEqual(calls[6].values, [42]);
  assert.deepEqual(result, {
    reviews: [], practice: [], listening: [], legacy: [], first: {},
    vocabularyToday: { completed: 0, remaining: 0 },
    settings: { dailyListeningGoal: 3 },
  });
});

test('a failed source rejects the whole read rather than presenting false unpracticed days', async () => {
  const pool = { execute: async sql => {
    if (sql.includes('FROM listening_attempts')) throw new Error('Database unavailable');
    return [[]];
  } };
  await assert.rejects(new MySqlLearningTimelineRepository(pool).read(1, { from: '2026-09-01', to: '2026-09-06' }), /Database unavailable/u);
});
