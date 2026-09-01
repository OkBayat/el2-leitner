import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { filterAndSortWords } from '../src/features/leitner-house/application/GetLeitnerHouse.js';
import { parseLeitnerHouse } from '../src/features/leitner-house/domain/LeitnerHouse.js';
import { formatRelativeDue, LeitnerHousePage } from '../src/features/leitner-house/presentation/LeitnerHousePage.js';

await import('../leitner-status.js');
const status = globalThis.VocoraLeitnerStatus;
assert.ok(status, 'Dashboard Leitner module must remain available');

assert.equal(parseLeitnerHouse('1'), 1);
assert.equal(parseLeitnerHouse(5), 5);
assert.equal(parseLeitnerHouse('0'), null);
assert.equal(parseLeitnerHouse('6'), null);
assert.equal(parseLeitnerHouse('abc'), null);

const sourceWords = [
  { id: 'a', term: 'facilities', accepted: ['facilities'], category: 'General', tags: ['ielts'], lessons: ['Unit 3'], mistakes: 14, attempts: 20, correct: 6, due: '2026-09-01', lastReviewed: '2026-08-31T10:00:00.000Z' },
  { id: 'b', term: 'Spacious', accepted: ['Spacious'], category: 'Home', tags: [], lessons: ['Lesson B'], mistakes: 2, attempts: 5, correct: 3, due: '2026-09-05', lastReviewed: null },
  { id: 'c', term: 'etiquette', accepted: ['etiquette'], category: 'Social', tags: ['behavior'], lessons: [], mistakes: 9, attempts: 12, correct: 3, due: null, lastReviewed: '2026-08-20T10:00:00.000Z' }
];

assert.deepEqual(filterAndSortWords(sourceWords, { search: 'unit 3', sort: 'mistakes' }).map((word) => word.id), ['a']);
assert.deepEqual(filterAndSortWords(sourceWords, { search: 'HOME', sort: 'mistakes' }).map((word) => word.id), ['b']);
assert.deepEqual(filterAndSortWords(sourceWords, { search: '', sort: 'mistakes' }).map((word) => word.id), ['a', 'c', 'b']);
assert.deepEqual(filterAndSortWords(sourceWords, { search: '', sort: 'alpha' }).map((word) => word.id), ['c', 'a', 'b']);
assert.deepEqual(filterAndSortWords(sourceWords, { search: '', sort: 'due' }).map((word) => word.id), ['a', 'b', 'c']);
assert.deepEqual(filterAndSortWords(sourceWords, { search: '', sort: 'recent' }).map((word) => word.id), ['a', 'c', 'b']);

assert.equal(formatRelativeDue('2026-09-01', '2026-09-01'), 'امروز');
assert.equal(formatRelativeDue('2026-09-02', '2026-09-01'), 'فردا');
assert.equal(formatRelativeDue('2026-08-31', '2026-09-01'), 'عقب‌افتاده');
assert.equal(formatRelativeDue(null, '2026-09-01'), '—');

const html = status.renderDistributionHtml({
  houses: [
    { box: 1, total: 2, segments: [2] },
    { box: 2, total: 3, segments: [1, 2] }
  ]
});
assert.match(html, /href="leitner-house\.html\?box=1"/, 'House one must navigate to its detail page');
assert.match(html, /href="leitner-house\.html\?box=2"/, 'Every house row must navigate to its own detail page');
assert.match(html, /aria-label="مشاهدهٔ تمام واژه‌های خانه ۱"/, 'Clickable house rows need an accessible navigation label');

const pageHtml = fs.readFileSync(new URL('../leitner-house.html', import.meta.url), 'utf8');
const dom = new JSDOM(pageHtml);
const document = dom.window.document;
assert.ok(document.querySelector('#leitnerHouseBackBtn'));
assert.ok(document.querySelector('#leitnerHouseSearch'));
assert.ok(document.querySelector('#leitnerHouseSort'));
assert.ok(document.querySelector('#leitnerHouseWordsBody'));
assert.ok(document.querySelector('#leitnerHouseInfo'));
assert.ok(document.querySelector('script[type="module"][src="./src/features/leitner-house/index.js"]'));

const interactiveDom = new JSDOM(pageHtml, { url: 'https://vocora.test/leitner-house.html?box=2' });
const interactiveDocument = interactiveDom.window.document;
const requestedHouses = [];
const page = new LeitnerHousePage({
  document: interactiveDocument,
  window: interactiveDom.window,
  getHouseQuery: {
    async execute(house) {
      requestedHouses.push(house);
      return {
        house: { number: 2, reviewIntervalDays: 2, stateCount: 2 },
        summary: { totalWords: 3, dueWords: 1, totalAttempts: 37, totalMistakes: 25 },
        words: sourceWords
      };
    }
  },
  navigate() {}
});
await page.mount();

assert.deepEqual(requestedHouses, [2], 'Detail page must execute the dedicated Leitner house query');
assert.equal(interactiveDocument.querySelector('#leitnerHouseTotal').textContent, '۳');
assert.equal(interactiveDocument.querySelectorAll('#leitnerHouseWordsBody tr').length, 3);

const searchInput = interactiveDocument.querySelector('#leitnerHouseSearch');
searchInput.value = 'home';
searchInput.dispatchEvent(new interactiveDom.window.Event('input'));
assert.equal(interactiveDocument.querySelectorAll('#leitnerHouseWordsBody tr').length, 1);
assert.equal(interactiveDocument.querySelector('#leitnerHouseWordsBody strong').textContent, 'Spacious');

searchInput.value = '';
searchInput.dispatchEvent(new interactiveDom.window.Event('input'));
const sortSelect = interactiveDocument.querySelector('#leitnerHouseSort');
sortSelect.value = 'alpha';
sortSelect.dispatchEvent(new interactiveDom.window.Event('change'));
assert.equal(interactiveDocument.querySelector('#leitnerHouseWordsBody strong').textContent, 'etiquette');

page.destroy();
dom.window.close();
interactiveDom.window.close();

console.log('Leitner house page regression tests passed.');
