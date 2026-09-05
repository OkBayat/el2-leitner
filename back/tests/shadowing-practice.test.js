import test from 'node:test';
import assert from 'node:assert/strict';
import { ShadowingPractice } from '../src/application/shadowing-practice/ShadowingPractice.js';

function fixture() {
  const calls = { houses: [], attempts: [], completed: [], cancelled: [] };
  let rows = [{ wordId: 'word-1', box: 1, term: 'name', acceptedForm: 'name' }];
  const sentences = [{ id: 'sentence-1', text: 'My name is Sara.' }];
  const speech = {
    ready: async () => {}, start: async () => {},
    chunk: async () => 'my name', finish: async () => 'my name is sara',
    cancel: async id => { calls.cancelled.push(id); },
  };
  const repository = {
    start: async () => ({ id: 'session-1' }),
    recordAttempt: async (...args) => { calls.attempts.push(args); return { daily: { day: '2026-09-05', attempts: calls.attempts.length } }; },
    complete: async (...args) => { calls.completed.push(args); },
  };
  let now = 0;
  const service = new ShadowingPractice({
    getSentencePracticeCards: { execute: async (user, house) => { calls.houses.push([user, house]); return { cards: [{ id: 'word-1', term: 'name', box: 1, sentences }] }; } },
    sentencePracticeRepository: { findWordsForHouse: async (_user, house) => { assert.equal(house, 1); return rows; }, findActiveSentences: async () => sentences },
    practiceSessionRepository: repository, speech, now: () => now,
  });
  return { service, speech, repository, calls, move: () => { rows = []; }, expire: () => { now += 31 * 60 * 1000; } };
}
async function recording(f) {
  await f.service.start('user-1');
  return (await f.service.record('user-1', 'session-1', { wordId: 'word-1', sentenceId: 'sentence-1', day: '2026-09-05' })).recordingId;
}

test('always uses Box 1 and returns whole sentences without a cloze', async () => {
  const f = fixture(); const deck = await f.service.start('user-1');
  assert.deepEqual(f.calls.houses, [['user-1', 1]]);
  assert.equal(deck.cards[0].sentences[0].text, 'My name is Sara.');
  assert.equal(deck.cards[0].sentences[0].words[1].text, 'name');
  assert.equal(deck.threshold, 90);
});
test('rejects another user and client-invented sentences', async () => {
  const f = fixture(); await f.service.start('user-1');
  await assert.rejects(f.service.record('user-2', 'session-1', {}), { code: 'SHADOWING_SESSION_EXPIRED' });
  await assert.rejects(f.service.record('user-1', 'session-1', { wordId: 'bad', sentenceId: 'bad', day: '2026-09-05' }), { code: 'SHADOWING_INVALID_SENTENCE' });
});
test('rechecks Box 1 membership when starting every recording', async () => {
  const f = fixture(); await f.service.start('user-1'); f.move();
  await assert.rejects(f.service.record('user-1', 'session-1', { wordId: 'word-1', sentenceId: 'sentence-1', day: '2026-09-05' }), { code: 'SHADOWING_WORD_MOVED' });
});
test('streams tentative words and records a final result only once', async () => {
  const f = fixture(); const id = await recording(f);
  const partial = await f.service.chunk('user-1', 'session-1', id, 0, Buffer.alloc(16000));
  assert.equal(partial.matchedCount, 2); assert.equal(f.calls.attempts.length, 0);
  const result = await f.service.finish('user-1', 'session-1', id);
  assert.equal(result.passed, true);
  assert.deepEqual(await f.service.finish('user-1', 'session-1', id), result);
  assert.equal(f.calls.attempts.length, 1);
  assert.equal(f.calls.attempts[0][2].correct, true);
});
test('same chunk retries are idempotent but reordered/changed audio is rejected', async () => {
  const f = fixture(); const id = await recording(f); let calls = 0;
  f.speech.chunk = async () => { calls++; return 'my'; };
  const audio = Buffer.alloc(16000);
  await f.service.chunk('user-1', 'session-1', id, 0, audio);
  await f.service.chunk('user-1', 'session-1', id, 0, audio);
  assert.equal(calls, 1);
  await assert.rejects(f.service.chunk('user-1', 'session-1', id, 0, Buffer.alloc(16000, 1)), { code: 'SHADOWING_AUDIO_ORDER' });
  await assert.rejects(f.service.chunk('user-1', 'session-1', id, 4, audio), { code: 'SHADOWING_AUDIO_ORDER' });
});
test('silence, provider failures and invalid audio never count as wrong answers', async () => {
  const f = fixture(); const id = await recording(f);
  await assert.rejects(f.service.chunk('user-1', 'session-1', id, 0, Buffer.alloc(3)), { code: 'SHADOWING_INVALID_AUDIO' });
  await f.service.chunk('user-1', 'session-1', id, 0, Buffer.alloc(16000));
  f.speech.finish = async () => '';
  await assert.rejects(f.service.finish('user-1', 'session-1', id), { code: 'SHADOWING_NO_SPEECH' });
  assert.equal(f.calls.attempts.length, 0);
});
test('preserves a final transcript if saving the practice result needs a retry', async () => {
  const f = fixture(); const id = await recording(f); let speechCalls = 0;
  await f.service.chunk('user-1', 'session-1', id, 0, Buffer.alloc(16000));
  f.speech.finish = async () => { speechCalls++; return 'my name is sara'; };
  const save = f.repository.recordAttempt; f.repository.recordAttempt = async () => { throw new Error('database unavailable'); };
  await assert.rejects(f.service.finish('user-1', 'session-1', id));
  f.repository.recordAttempt = save;
  await f.service.finish('user-1', 'session-1', id);
  assert.equal(speechCalls, 1); assert.equal(f.calls.attempts.length, 1);
});
test('limits recording length and releases sessions on exit and expiry', async () => {
  const f = fixture(); const id = await recording(f);
  f.service.sessions.get('session-1').recording.bytes = 960000;
  await assert.rejects(f.service.chunk('user-1', 'session-1', id, 0, Buffer.alloc(16000)), { code: 'SHADOWING_AUDIO_LIMIT' });
  f.expire(); assert.throws(() => f.service.get('user-1', 'session-1'), { code: 'SHADOWING_SESSION_EXPIRED' });
  assert.ok(f.calls.cancelled.includes(id));
});
