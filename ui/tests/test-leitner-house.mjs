import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

await import('../leitner-status.js');
await import('../leitner-house.js');

const housePage = globalThis.VocoraLeitnerHouse;
const status = globalThis.VocoraLeitnerStatus;

assert.ok(housePage, 'Leitner house page module must expose a testable API');
assert.ok(status, 'Dashboard Leitner module must remain available');

assert.equal(housePage.parseHouseNumber('1'), 1);
assert.equal(housePage.parseHouseNumber(5), 5);
assert.equal(housePage.parseHouseNumber('0'), null);
assert.equal(housePage.parseHouseNumber('6'), null);
assert.equal(housePage.parseHouseNumber('abc'), null);

const sourceWords = [
  { id: 'a', term: 'facilities', accepted: ['facilities'], category: 'General', tags: ['ielts'], lessons: ['Unit 3'], mistakes: 14, attempts: 20, correct: 6, due: '2026-09-01', lastReviewed: '2026-08-31T10:00:00.000Z' },
  { id: 'b', term: 'Spacious', accepted: ['Spacious'], category: 'Home', tags: [], lessons: ['Lesson B'], mistakes: 2, attempts: 5, correct: 3, due: '2026-09-05', lastReviewed: null },
  { id: 'c', term: 'etiquette', accepted: ['etiquette'], category: 'Social', tags: ['behavior'], lessons: [], mistakes: 9, attempts: 12, correct: 3, due: null, lastReviewed: '2026-08-20T10:00:00.000Z' }
];

assert.deepEqual(
  housePage.filterAndSortWords(sourceWords, { search: 'unit 3', sort: 'mistakes' }).map((word) => word.id),
  ['a'],
  'Search must include lesson metadata as well as the word itself'
);
assert.deepEqual(
  housePage.filterAndSortWords(sourceWords, { search: 'HOME', sort: 'mistakes' }).map((word) => word.id),
  ['b'],
  'Search must be case-insensitive and include category metadata'
);
assert.deepEqual(
  housePage.filterAndSortWords(sourceWords, { search: '', sort: 'mistakes' }).map((word) => word.id),
  ['a', 'c', 'b'],
  'Mistake sorting must put the hardest words first'
);
assert.deepEqual(
  housePage.filterAndSortWords(sourceWords, { search: '', sort: 'alpha' }).map((word) => word.id),
  ['c', 'a', 'b'],
  'Alphabetical sorting must be stable and case-insensitive'
);
assert.deepEqual(
  housePage.filterAndSortWords(sourceWords, { search: '', sort: 'due' }).map((word) => word.id),
  ['a', 'b', 'c'],
  'Due sorting must put words without a due date last'
);
assert.deepEqual(
  housePage.filterAndSortWords(sourceWords, { search: '', sort: 'recent' }).map((word) => word.id),
  ['a', 'c', 'b'],
  'Recent sorting must put never-reviewed words last'
);

assert.equal(housePage.formatRelativeDue('2026-09-01', '2026-09-01'), 'امروز');
assert.equal(housePage.formatRelativeDue('2026-09-02', '2026-09-01'), 'فردا');
assert.equal(housePage.formatRelativeDue('2026-08-31', '2026-09-01'), 'عقب‌افتاده');
assert.equal(housePage.formatRelativeDue(null, '2026-09-01'), '—');

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
assert.ok(document.querySelector('#leitnerHouseBackBtn'), 'Detail page must provide a back button');
assert.ok(document.querySelector('#leitnerHouseSearch'), 'Detail page must provide search');
assert.ok(document.querySelector('#leitnerHouseSort'), 'Detail page must provide sorting');
assert.ok(document.querySelector('#leitnerHouseWordsBody'), 'Detail page must provide the complete words table');
assert.ok(document.querySelector('#leitnerHouseInfo'), 'Detail page must display house information');
assert.ok(document.querySelector('script[src="leitner-house.js"]'), 'Detail page must load the dedicated query UI module');

const interactiveDom = new JSDOM(pageHtml, { url: 'https://vocora.test/leitner-house.html?box=2' });
const interactiveDocument = interactiveDom.window.document;
let requestedUrl = null;
await housePage.mount({
  document: interactiveDocument,
  window: interactiveDom.window,
  fetch: async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          house: { number: 2, reviewIntervalDays: 2, stateCount: 2 },
          summary: { totalWords: 3, dueWords: 1, totalAttempts: 37, totalMistakes: 25 },
          words: sourceWords
        };
      }
    };
  }
});

assert.equal(requestedUrl, '/api/learning/boxes/2', 'Detail page must use the dedicated Leitner read endpoint');
assert.equal(interactiveDocument.querySelector('#leitnerHouseTotal').textContent, '۳', 'House summary must render API totals');
assert.equal(interactiveDocument.querySelectorAll('#leitnerHouseWordsBody tr').length, 3, 'All house words must be visible initially');

const searchInput = interactiveDocument.querySelector('#leitnerHouseSearch');
searchInput.value = 'home';
searchInput.dispatchEvent(new interactiveDom.window.Event('input'));
assert.equal(interactiveDocument.querySelectorAll('#leitnerHouseWordsBody tr').length, 1, 'Search must immediately filter the rendered table');
assert.equal(interactiveDocument.querySelector('#leitnerHouseWordsBody strong').textContent, 'Spacious');

searchInput.value = '';
searchInput.dispatchEvent(new interactiveDom.window.Event('input'));
const sortSelect = interactiveDocument.querySelector('#leitnerHouseSort');
sortSelect.value = 'alpha';
sortSelect.dispatchEvent(new interactiveDom.window.Event('change'));
assert.equal(interactiveDocument.querySelector('#leitnerHouseWordsBody strong').textContent, 'etiquette', 'Sort selection must immediately reorder the rendered table');

console.log('Leitner house page regression tests passed.');
