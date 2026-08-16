import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const rawHtml = fs.readFileSync(new URL('index.html', root), 'utf8');
const html = rawHtml
  .replace(/<script src="vocabulary\.js"><\/script>/, '')
  .replace(/<script src="share-story-v2\.js"><\/script>/, '')
  .replace(/<script src="app-v2\.js"><\/script>/, '');
const vocabulary = fs.readFileSync(new URL('vocabulary.js', root), 'utf8');
const shareStory = fs.readFileSync(new URL('share-story-v2.js', root), 'utf8');
const app = fs.readFileSync(new URL('app-v2.js', root), 'utf8');

let serverState = null;
let serverRevision = 0;

function mockResponse(status, payload = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload === null ? '' : JSON.stringify(payload); }
  };
}

const dom = new JSDOM(html, {
  url: 'https://vocora.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    window.speechSynthesis = { cancel() {}, speak() {}, getVoices() { return []; } };
    window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
    window.fetch = async (path, options = {}) => {
      const method = options.method || 'GET';
      if (path === '/api/auth/me' && method === 'GET') {
        return mockResponse(200, { user: { id: 12, email: 'progress@example.com' } });
      }
      if (path === '/api/state' && method === 'GET') {
        return mockResponse(200, { state: serverState, revision: serverRevision });
      }
      if (path === '/api/state' && method === 'PUT') {
        const payload = JSON.parse(options.body);
        assert.equal(payload.revision, serverRevision);
        serverState = JSON.parse(JSON.stringify(payload.state));
        serverRevision += 1;
        return mockResponse(200, { state: serverState, revision: serverRevision });
      }
      return mockResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
    };
  }
});

dom.window.eval(vocabulary);
dom.window.eval(shareStory);
dom.window.eval(app);
await dom.window.VazheyarReady;

const { document, VazheyarTest } = dom.window;
await VazheyarTest.waitForSaves();

document.querySelector('[data-view="review"]').click();
document.querySelector('#beginSessionBtn').click();
assert.equal(
  document.querySelector('#sessionCounter').textContent,
  'کارت ۱ از ۱۰',
  'Today review should be a simple finite pass over the cards that were due when the session started'
);
assert.doesNotMatch(
  document.querySelector('#sessionCounter').textContent,
  /تکرار خطا|اصلی|مجموع/,
  'Scheduled review should not expose retry bookkeeping'
);

const mistakenId = VazheyarTest.getCurrentWord().id;
document.querySelector('#dontKnowBtn').click();
assert.equal(
  document.querySelector('#sessionCounter').textContent,
  'کارت ۲ از ۱۰',
  'A wrong answer must not expand the scheduled review total'
);
assert.equal(document.querySelector('#sessionProgressBar').style.width, '10%');

const seenIds = [mistakenId];
for (let index = 1; index < 10; index += 1) {
  document.querySelector('#nextCardBtn').click();
  const word = VazheyarTest.getCurrentWord();
  assert.ok(word, `Scheduled card ${index + 1} should exist`);
  assert.notEqual(word.id, mistakenId, 'A wrong scheduled card must not be reinserted into the same session');
  assert.equal(seenIds.includes(word.id), false, 'Each scheduled card should appear only once in the pass');
  seenIds.push(word.id);
  document.querySelector('#answerInput').value = word.term;
  document.querySelector('#answerForm button[type="submit"]').click();
}

assert.equal(seenIds.length, 10);
assert.equal(new Set(seenIds).size, 10, 'The scheduled pass should contain ten distinct original cards');
document.querySelector('#nextCardBtn').click();
assert.equal(
  document.querySelector('#sessionComplete').classList.contains('hidden'),
  false,
  'Today review should finish immediately after the original queue is exhausted'
);

await VazheyarTest.waitForSaves();
const mistakenEvents = serverState.history.filter((event) => event.wordId === mistakenId);
assert.equal(mistakenEvents.length, 1, 'The mistaken word should have exactly one scheduled assessment in this session');
assert.equal(mistakenEvents[0].correct, false);
const mistakenWord = serverState.words.find((word) => word.id === mistakenId);
assert.equal(mistakenWord.box, 1, 'A scheduled mistake must still return the word to box 1');
assert.equal(mistakenWord.due, VazheyarTest.addDays(VazheyarTest.localDay(), 1), 'A scheduled mistake remains due tomorrow');
assert.equal(mistakenWord.blockedUntil, VazheyarTest.addDays(VazheyarTest.localDay(), 1), 'Promotion remains blocked until tomorrow');

console.log('Scheduled review single-pass test passed.');
