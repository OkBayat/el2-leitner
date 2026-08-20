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

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(day, amount) {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year, month - 1, date + amount, 12));
}

const today = localDay();
const legacyMasteredAt = new Date().toISOString();
const legacyFinalReviewAt = new Date(Date.now() - 60_000).toISOString();
let serverState = {
  schemaVersion: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings: { dailyNew: 1, dailyGoal: 5, voiceRate: 0.85, theme: 'system' },
  words: [{
    id: 'box-five-word',
    number: 1,
    term: 'graduation',
    accepted: ['graduation'],
    category: 'Regression',
    notes: '',
    createdAt: new Date().toISOString(),
    box: 5,
    due: addDays(today, 14),
    attempts: 4,
    correct: 4,
    mistakes: 0,
    currentStreak: 4,
    introducedOn: addDays(today, -30),
    addedSource: 'test',
    lastReviewed: new Date().toISOString(),
    lastPromotedDay: today,
    blockedUntil: null,
    masteredAt: legacyMasteredAt
  }, {
    id: 'already-reviewed-word',
    number: 2,
    term: 'completed',
    accepted: ['completed'],
    category: 'Regression',
    notes: '',
    createdAt: new Date().toISOString(),
    box: 5,
    due: addDays(today, 14),
    attempts: 5,
    correct: 5,
    mistakes: 0,
    currentStreak: 5,
    introducedOn: addDays(today, -45),
    addedSource: 'test',
    lastReviewed: legacyFinalReviewAt,
    lastPromotedDay: today,
    blockedUntil: null,
    masteredAt: legacyMasteredAt
  }],
  daily: {},
  history: [
    { at: legacyMasteredAt, day: today, wordId: 'box-five-word', term: 'graduation', answer: 'graduation', correct: true, mode: 'scheduled', promoted: true, previousBox: 4, newBox: 5, mistakeNumber: null },
    { at: legacyFinalReviewAt, day: today, wordId: 'already-reviewed-word', term: 'completed', answer: 'completed', correct: true, mode: 'scheduled', promoted: true, previousBox: 5, newBox: 5, mistakeNumber: null }
  ]
};
let serverRevision = 1;

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
        return mockResponse(200, { user: { id: 15, email: 'graduation@example.com' } });
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

const hydratedWord = VazheyarTest.getState().words[0];
assert.equal(hydratedWord.box, 5);
assert.equal(hydratedWord.due, addDays(today, 14));
assert.equal(
  hydratedWord.masteredAt,
  null,
  'Existing box-5 cards with only an entry promotion are pending their final review, not already mastered'
);
const alreadyReviewedWord = VazheyarTest.getState().words.find((word) => word.id === 'already-reviewed-word');
assert.equal(alreadyReviewedWord.due, null, 'A historical successful box-5 review must be repaired as already graduated');
assert.equal(alreadyReviewedWord.masteredAt, legacyFinalReviewAt, 'Historical mastery must use the actual final-review timestamp');

Object.assign(hydratedWord, {
  box: 4,
  due: today,
  lastPromotedDay: null,
  blockedUntil: null,
  masteredAt: null
});

document.querySelector('[data-view="review"]').click();
document.querySelector('#beginSessionBtn').click();
assert.equal(VazheyarTest.getCurrentWord().id, hydratedWord.id);
document.querySelector('#answerInput').value = hydratedWord.term;
document.querySelector('#answerForm button[type="submit"]').click();
await VazheyarTest.waitForSaves();

let savedWord = serverState.words.find((word) => word.id === hydratedWord.id);
assert.equal(savedWord.box, 5, 'A correct due answer in box 4 must enter box 5');
assert.equal(savedWord.due, addDays(today, 14), 'Entering box 5 must schedule its final review 14 days later');
assert.equal(savedWord.masteredAt, null, 'Entering box 5 alone must not mark the word as mastered');

document.querySelector('#nextCardBtn').click();
Object.assign(hydratedWord, {
  due: today,
  lastPromotedDay: addDays(today, -14),
  masteredAt: null
});

document.querySelector('[data-view="review"]').click();
document.querySelector('#beginSessionBtn').click();
assert.equal(VazheyarTest.getCurrentWord().box, 5);
document.querySelector('#answerInput').value = hydratedWord.term;
document.querySelector('#answerForm button[type="submit"]').click();
await VazheyarTest.waitForSaves();

savedWord = serverState.words.find((word) => word.id === hydratedWord.id);
assert.equal(savedWord.box, 5, 'A mastered word remains represented in house 5');
assert.equal(savedWord.due, null, 'A successful final box-5 review must remove the word from scheduled review');
assert.ok(savedWord.masteredAt, 'A successful final box-5 review must record mastery time');
assert.equal(savedWord.lastPromotedDay, today);
assert.match(document.querySelector('#feedbackDetail').textContent, /چرخه.*مرور|مرور.*خارج/);

const finalEvent = serverState.history.at(-1);
assert.equal(finalEvent.previousBox, 5);
assert.equal(finalEvent.newBox, 5);
assert.equal(finalEvent.correct, true);
assert.equal(finalEvent.promoted, true, 'Final mastery is still a successful Leitner promotion event');
assert.equal(finalEvent.at, savedWord.lastReviewed, 'One review must have one authoritative timestamp in progress and history');
assert.equal(finalEvent.at, savedWord.masteredAt, 'The final review event timestamp must be the mastery timestamp');
assert.equal(VazheyarTest.buildAnalysisReport().profile.masteredWords, 2, 'Mastery stats must count only cards that completed the final review');

document.querySelector('#nextCardBtn').click();
document.querySelector('[data-view="review"]').click();
assert.equal(
  document.querySelector('#reviewEmpty').classList.contains('hidden'),
  false,
  'A mastered box-5 word must not return to the due queue'
);

console.log('Leitner box-5 graduation regression test passed.');
