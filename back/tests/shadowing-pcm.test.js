import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../../ui/assets/shadowing/pcm-capture.js', import.meta.url), 'utf8');
function processor(rate) {
  const messages = [];
  let Processor;
  vm.runInNewContext(source, {
    sampleRate: rate, ArrayBuffer, DataView,
    AudioWorkletProcessor: class { port = { postMessage: data => messages.push(data) }; },
    registerProcessor: (_name, value) => { Processor = value; },
  });
  return { instance: new Processor(), messages };
}
for (const rate of [44100, 48000]) {
  test(`resamples ${rate} Hz without losing chunk boundaries and flushes the tail`, () => {
    const { instance, messages } = processor(rate);
    const input = new Float32Array(Math.round(rate * 1.1)).fill(.5);
    for (let i = 0; i < input.length; i += 128) instance.process([[input.slice(i, i + 128)]]);
    instance.port.onmessage({ data: 'flush' });
    const chunks = messages.filter(message => message.type === 'pcm');
    assert.equal(chunks.reduce((total, chunk) => total + chunk.pcm.byteLength, 0), 35200);
    assert.ok(chunks.every(chunk => chunk.pcm.byteLength <= 16000));
    assert.equal(new DataView(chunks[0].pcm).getInt16(0, true), 16384);
    assert.equal(messages.at(-1).type, 'flushed');
    assert.equal(instance.process([]), false);
  });
}
test('caps audio at thirty seconds and produces a real RMS level', () => {
  const { instance, messages } = processor(16000);
  const input = new Float32Array(1024).fill(-1);
  for (let i = 0; i < 500; i++) instance.process([[input]]);
  assert.equal(messages.filter(message => message.type === 'pcm').reduce((total, chunk) => total + chunk.pcm.byteLength, 0), 960000);
  assert.equal(messages.filter(message => message.type === 'limit').length, 1);
  assert.equal(messages.find(message => message.type === 'level').rms, 1);
});
