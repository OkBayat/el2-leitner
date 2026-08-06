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
assert.match(
  document.querySelector('#sessionCounter').textContent,
  /مجموع ۱ از ۱۰.*اصلی ۱ از ۱۰.*تکرار خطا ۰ از ۰/,
  'A scheduled session should start with separate original and retry counts'
);

const mistakenId = VazheyarTest.getCurrentWord().id;
document.querySelector('#dontKnowBtn').click();
assert.match(
  document.querySelector('#sessionCounter').textContent,
  /مجموع ۱ از ۱۱.*اصلی ۱ از ۱۰.*تکرار خطا ۰ از ۱/,
  'A wrong answer should immediately expand the real session total'
);
assert.equal(document.querySelector('#sessionProgressBar').style.width, '9%');

for (let index = 0; index < 3; index += 1) {
  document.querySelector('#nextCardBtn').click();
  const word = VazheyarTest.getCurrentWord();
  document.querySelector('#answerInput').value = word.term;
  document.querySelector('#answerForm button[type="submit"]').click();
}

document.querySelector('#nextCardBtn').click();
assert.equal(VazheyarTest.getCurrentWord().id, mistakenId, 'The scheduled retry should still appear after three intervening cards');
assert.match(
  document.querySelector('#sessionCounter').textContent,
  /مجموع ۵ از ۱۱.*اصلی ۴ از ۱۰.*تکرار خطا ۱ از ۱/,
  'Showing the retry should advance the retry and overall counters'
);
assert.equal(document.querySelector('#sessionProgressBar').style.width, '36%');

document.querySelector('#answerInput').value = VazheyarTest.getCurrentWord().term;
document.querySelector('#answerForm button[type="submit"]').click();
assert.match(
  document.querySelector('#sessionCounter').textContent,
  /مجموع ۵ از ۱۱.*اصلی ۴ از ۱۰.*تکرار خطا ۱ از ۱/,
  'The feedback state should keep the completed retry position visible'
);
assert.equal(document.querySelector('#sessionProgressBar').style.width, '45%');

await VazheyarTest.waitForSaves();
console.log('Scheduled review retry progress test passed.');
