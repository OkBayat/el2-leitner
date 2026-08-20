import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

await import('../leitner-status.js');
const leitner = globalThis.VocoraLeitnerStatus;

const root = new URL('../', import.meta.url);
const rawHtml = fs.readFileSync(new URL('index.html', root), 'utf8');
const html = rawHtml
  .replace(/<script src="vocabulary\.js"><\/script>/, '')
  .replace(/<script src="share-story-v2\.js"><\/script>/, '')
  .replace(/<script src="app-v2\.js"><\/script>/, '');
const vocabulary = fs.readFileSync(new URL('vocabulary.js', root), 'utf8');
const shareStory = fs.readFileSync(new URL('share-story-v2.js', root), 'utf8');
const app = fs.readFileSync(new URL('app-v2.js', root), 'utf8');
const sessionPersistence = fs.readFileSync(new URL('session-persistence.js', root), 'utf8');

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
const entryAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
const finalReviewAt = new Date(Date.now() - 60_000).toISOString();
let serverRevision = 7;
let stateWrites = 0;
let serverState = {
  schemaVersion: 2,
  createdAt: entryAt,
  updatedAt: finalReviewAt,
  settings: { dailyNew: 1, dailyGoal: 5, voiceRate: 0.85, theme: 'system' },
  words: [
    {
      id: 'pending-box-five', number: 1, term: 'pending', accepted: ['pending'], category: 'Regression', notes: '',
      createdAt: entryAt, box: 5, due: addDays(today, 14), attempts: 4, correct: 4, mistakes: 0,
      currentStreak: 4, introducedOn: addDays(today, -30), addedSource: 'test', lastReviewed: entryAt,
      lastPromotedDay: addDays(today, -14), blockedUntil: null, masteredAt: null
    },
    {
      id: 'canonical-center', number: 2, term: 'center', accepted: ['center', 'centre'], category: 'Regression', notes: '',
      createdAt: entryAt, box: 5, due: null, attempts: 5, correct: 5, mistakes: 0,
      currentStreak: 5, introducedOn: addDays(today, -45), addedSource: 'test', lastReviewed: finalReviewAt,
      lastPromotedDay: today, blockedUntil: null, masteredAt: finalReviewAt
    }
  ],
  daily: {},
  history: [
    {
      at: entryAt, day: addDays(today, -14), wordId: 'pending-box-five', term: 'pending', answer: 'pending',
      correct: true, mode: 'scheduled', promoted: true, previousBox: 4, newBox: 5, mistakeNumber: null
    },
    {
      at: finalReviewAt, day: today, wordId: 'retired-alias-id', term: 'centre', answer: 'centre',
      correct: true, mode: 'scheduled', promoted: true, previousBox: 5, newBox: 5, mistakeNumber: null
    }
  ]
};

function mockResponse(status, payload = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload === null ? '' : JSON.stringify(payload); },
    async json() { return payload === null ? null : JSON.parse(JSON.stringify(payload)); },
    clone() { return mockResponse(status, payload); }
  };
}

const dom = new JSDOM(html, {
  url: 'https://vocora.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.Headers = globalThis.Headers;
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    window.speechSynthesis = { cancel() {}, speak() {}, getVoices() { return []; } };
    window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
    window.fetch = async (path, options = {}) => {
      const method = String(options.method || 'GET').toUpperCase();
      if (path === '/api/auth/me' && method === 'GET') return mockResponse(200, { user: { id: 20, email: 'repair@example.com' } });
      if (path === '/api/state' && method === 'GET') return mockResponse(200, { state: serverState, revision: serverRevision });
      if (path === '/api/state' && method === 'PUT') {
        const payload = JSON.parse(options.body);
        assert.equal(payload.revision, serverRevision);
        stateWrites += 1;
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
dom.window.eval(sessionPersistence);
await dom.window.VazheyarReady;

const { document, VazheyarTest } = dom.window;
await VazheyarTest.waitForSaves();
const state = VazheyarTest.getState();
const pending = state.words.find((word) => word.id === 'pending-box-five');
const repaired = state.words.find((word) => word.id === 'canonical-center');

assert.equal(pending.masteredAt, null, 'Entering box 5 must remain pending until the final review');
assert.ok(pending.due, 'A pending box-5 card must keep its final-review due date');
assert.equal(repaired.due, null, 'Server-repaired mastery must stay outside scheduled review');
assert.equal(repaired.masteredAt, finalReviewAt, 'UI must preserve the server-owned final-review timestamp');
assert.equal(stateWrites, 0, 'Loading repaired state must not trigger a client-side mastery write');
assert.equal(serverRevision, 7, 'A read-only UI load must not advance the learning-state revision');
assert.equal(serverState.words.find((word) => word.id === 'canonical-center').due, null, 'The server copy must retain the repaired mastery');

const faNumber = new Intl.NumberFormat('fa-IR');
assert.equal(document.querySelector('#masteredStat').textContent, faNumber.format(1), 'Dashboard mastery count must reflect repaired historical mastery');
assert.match(document.querySelector('#sideProgressCaption').textContent, new RegExp(faNumber.format(1)), 'Sidebar mastery summary must reflect repaired historical mastery');
const dashboardBoxCounts = [...document.querySelectorAll('#boxDistribution .box-count')].map((node) => node.textContent);
assert.equal(dashboardBoxCounts[4], faNumber.format(1), 'Dashboard house 5 must count only cards still active in the Leitner cycle');

const wordsNav = document.querySelector('.nav-item[data-view="words"]');
wordsNav.click();
const wordRows = [...document.querySelectorAll('#wordsTableBody tr')];
const masteredRow = wordRows.find((row) => row.textContent.includes('center'));
assert.ok(masteredRow, 'The mastered word must remain visible in the word bank');
assert.match(masteredRow.textContent, /تسلط/u, 'A mastered word must be labeled as mastery instead of house 5');

const boxFilter = document.querySelector('#boxFilter');
boxFilter.value = '5';
boxFilter.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
assert.equal(document.querySelector('#wordCountLabel').textContent, `${faNumber.format(1)} کلمه`, 'House-5 filter must exclude mastered words');
assert.doesNotMatch(document.querySelector('#wordsTableBody').textContent, /center/u, 'Mastered words must not reappear as active house-5 cards');

const distribution = leitner.buildDistribution(state.words, today);
assert.equal(distribution.houses[4].total, 1, 'Leitner visualization must exclude mastered words from active house 5');
assert.equal(distribution.total, 1, 'Leitner total must count only cards still in the active Leitner cycle');
leitner.attach({ document, getState: () => state, getToday: () => today, MutationObserver: null });
assert.equal(document.querySelector('[data-house="5"] .leitner-row-total strong').textContent, faNumber.format(1), 'Rendered house 5 must show only the pending final-review card');

const analysis = VazheyarTest.buildAnalysisReport();
assert.equal(analysis.profile.masteredWords, 1, 'Analysis report must count the repaired mastery');
assert.equal(analysis.boxDistribution.box_5, 1, 'Analysis box-5 distribution must count only active house-5 cards');

console.log('Historical mastery repair regression test passed.');
