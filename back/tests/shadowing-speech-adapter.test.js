import assert from 'node:assert/strict';
import { it } from 'node:test';
import { HttpSpeechRecognizer } from '../src/infrastructure/speech/HttpSpeechRecognizer.js';

it('keeps provider credentials, raw errors and target text out of browser responses', async () => {
  const unavailable = new HttpSpeechRecognizer();
  await assert.rejects(unavailable.ready(), { code: 'SHADOWING_UNAVAILABLE', statusCode: 503 });
  const broken = new HttpSpeechRecognizer({ url: 'http://speech:8080', fetchImpl: async () => { throw new Error('private-provider-secret'); } });
  await assert.rejects(broken.finish('id'), error => error.statusCode === 503 && !error.message.includes('private-provider-secret'));
  await broken.cancel('id');
});

it('sends only bounded PCM and recording identity to the private speech protocol', async () => {
  const calls = [];
  const speech = new HttpSpeechRecognizer({ url: 'http://speech:8080/', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ text: 'my name is sara' }) };
  } });
  await speech.ready(); await speech.start('recording');
  const pcm = Buffer.alloc(16000);
  assert.equal(await speech.chunk('recording', 0, pcm), 'my name is sara');
  await speech.finish('recording'); await speech.cancel('recording');
  assert.deepEqual(calls.map(call => call.options.method), ['GET', 'PUT', 'POST', 'POST', 'DELETE']);
  assert.equal(calls[2].options.body, pcm);
  assert.equal(calls[2].url, 'http://speech:8080/sessions/recording/chunks?sequence=0');
  assert.ok(calls.every(call => call.options.signal instanceof AbortSignal && call.options.redirect === 'error'));
});

it('rejects malformed transcripts and non-HTTP configuration', async () => {
  assert.throws(() => new HttpSpeechRecognizer({ url: 'file:///etc/passwd' }));
  for (const text of [42, 'x'.repeat(8001)]) {
    const speech = new HttpSpeechRecognizer({ url: 'http://speech:8080', fetchImpl: async () => ({ ok: true, json: async () => ({ text }) }) });
    await assert.rejects(speech.finish('id'), { code: 'SHADOWING_UNAVAILABLE' });
  }
});
