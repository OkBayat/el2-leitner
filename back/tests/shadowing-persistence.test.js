import assert from 'node:assert/strict';
import { it } from 'node:test';
import { MySqlPracticeSessionRepository } from '../src/infrastructure/persistence/mysql/MySqlPracticeSessionRepository.js';

function repository(mode) {
  const writes = [];
  const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
    execute: async (sql, args) => {
      if (/^\s*SELECT \* FROM practice_sessions/u.test(sql)) return [[{ id: 1, public_id: 's', mode, status: 'active', completed_count: 1, correct_count: 1, wrong_count: 0, duration_seconds: 0 }]];
      if (/^\s*SELECT \* FROM user_daily_stats/u.test(sql)) return [[{ day: '2026-09-05', attempts: 1, correct_count: 1, wrong_count: 0, new_added: 0, session_count: 0, duration_seconds: 0 }]];
      writes.push({ sql, args }); return [{ affectedRows: 1 }];
    },
  };
  return { instance: new MySqlPracticeSessionRepository({ getConnection: async () => connection }), writes };
}

it('allows server-graded Box 1 shadowing and writes only practice accounting', async () => {
  const { instance, writes } = repository('shadowing-house-1');
  const result = await instance.recordAttempt('u', 's', { day: '2026-09-05', correct: true, shadowing: true });
  assert.equal(result.daily.correct, 1);
  assert.equal(writes.length, 2);
  assert.ok(writes.every(write => /^\s*(UPDATE practice_sessions|INSERT INTO user_daily_stats)/u.test(write.sql)));
});

it('rejects client-graded shadowing and every other shadowing box', async () => {
  for (const [mode, shadowing] of [['shadowing-house-1', false], ['shadowing-house-2', true], ['review', true]]) {
    const { instance, writes } = repository(mode);
    await assert.rejects(instance.recordAttempt('u', 's', { day: '2026-09-05', correct: true, shadowing }), { code: 'INVALID_SESSION' });
    assert.equal(writes.length, 0);
  }
});
