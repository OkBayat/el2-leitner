import assert from 'node:assert/strict';
import { it } from 'node:test';
import { MySqlPracticeSessionRepository } from '../src/infrastructure/persistence/mysql/MySqlPracticeSessionRepository.js';

function repository(mode, failDailyEvidence = false) {
  const writes = [];
  const transaction = { committed: false, rolledBack: false, released: false };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { transaction.committed = true; },
    rollback: async () => { transaction.rolledBack = true; },
    release() { transaction.released = true; },
    execute: async (sql, args) => {
      if (/^\s*SELECT \* FROM practice_sessions/u.test(sql)) return [[{ id: 1, public_id: 's', mode, status: 'active', completed_count: 1, correct_count: 1, wrong_count: 0, duration_seconds: 0 }]];
      if (/^\s*SELECT \* FROM user_daily_stats/u.test(sql)) return [[{ day: '2026-09-05', attempts: 1, correct_count: 1, wrong_count: 0, new_added: 0, session_count: 0, duration_seconds: 0 }]];
      writes.push({ sql, args });
      if (failDailyEvidence && sql.includes('INSERT INTO practice_session_days')) throw new Error('Daily evidence unavailable');
      return [{ affectedRows: 1 }];
    },
  };
  return { instance: new MySqlPracticeSessionRepository({ getConnection: async () => connection }), writes, transaction };
}

it('allows server-graded Box 1 shadowing and writes only practice accounting and daily evidence', async () => {
  const { instance, writes, transaction } = repository('shadowing-house-1');
  const result = await instance.recordAttempt('u', 's', { day: '2026-09-05', correct: true, shadowing: true });
  assert.equal(result.daily.correct, 1);
  assert.equal(writes.length, 3);
  assert.ok(writes.every(write => /^\s*(UPDATE practice_sessions|INSERT INTO user_daily_stats|INSERT INTO practice_session_days)/u.test(write.sql)));
  const evidence = writes.filter(write => write.sql.includes('INSERT INTO practice_session_days'));
  assert.equal(evidence.length, 1);
  assert.deepEqual(evidence[0].args, [1, '2026-09-05']);
  assert.match(evidence[0].sql, /ON DUPLICATE KEY UPDATE/u);
  assert.equal(transaction.committed, true);
  assert.equal(transaction.rolledBack, false);
  assert.equal(transaction.released, true);
});

it('rejects client-graded shadowing and every other shadowing box', async () => {
  for (const [mode, shadowing] of [['shadowing-house-1', false], ['shadowing-house-2', true], ['review', true]]) {
    const { instance, writes } = repository(mode);
    await assert.rejects(instance.recordAttempt('u', 's', { day: '2026-09-05', correct: true, shadowing }), { code: 'INVALID_SESSION' });
    assert.equal(writes.length, 0);
  }
});

it('allows standalone attempts only for the registered practice-words modes', async () => {
  const modes = [
    'practice-words.vocabulary-dictation',
    'practice-words.sentence-completion',
    'practice-words.sentence-shadowing',
  ];

  for (const mode of modes) {
    const { instance, writes, transaction } = repository(mode);
    await instance.recordAttempt('u', 's', { day: '2026-09-05', correct: true });
    assert.equal(writes.length, 3);
    assert.equal(transaction.committed, true);
  }

  const { instance, writes } = repository('practice-words.unregistered');
  await assert.rejects(
    instance.recordAttempt('u', 's', { day: '2026-09-05', correct: true }),
    { code: 'INVALID_SESSION' },
  );
  assert.equal(writes.length, 0);
});

it('rolls back the attempt and daily totals when timeline evidence cannot be written', async () => {
  const { instance, transaction } = repository('shadowing-house-1', true);
  await assert.rejects(instance.recordAttempt('u', 's', { day: '2026-09-05', correct: false, shadowing: true }), /Daily evidence unavailable/u);
  assert.equal(transaction.committed, false);
  assert.equal(transaction.rolledBack, true);
  assert.equal(transaction.released, true);
});
