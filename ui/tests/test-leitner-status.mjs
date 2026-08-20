import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

await import('../leitner-status.js');
const leitner = globalThis.VocoraLeitnerStatus;
assert.ok(leitner, 'Leitner status module must expose its testable API');

const today = '2026-08-06';
const waits = leitner.DEFAULT_WAIT_DAYS;
const faNumber = new Intl.NumberFormat('fa-IR');

const words = [
  { id: 'h1-a', box: 1, due: today },
  { id: 'h1-b', box: 1, due: '2026-08-07' },

  { id: 'h2-s1', box: 2, due: '2026-08-08' },
  { id: 'h2-s2-a', box: 2, due: '2026-08-07' },
  { id: 'h2-s2-b', box: 2, due: today },

  { id: 'h3-s1', box: 3, due: '2026-08-09' },
  { id: 'h3-s2-a', box: 3, due: '2026-08-08' },
  { id: 'h3-s2-b', box: 3, due: '2026-08-08' },
  { id: 'h3-s3-a', box: 3, due: '2026-08-07' },
  { id: 'h3-s3-b', box: 3, due: '2026-08-07' },
  { id: 'h3-s3-c', box: 3, due: today },

  { id: 'h4-s1', box: 4, due: '2026-08-13' },
  { id: 'h4-s2-a', box: 4, due: '2026-08-11' },
  { id: 'h4-s2-b', box: 4, due: '2026-08-11' },
  { id: 'h4-s3-a', box: 4, due: '2026-08-09' },
  { id: 'h4-s3-b', box: 4, due: '2026-08-09' },
  { id: 'h4-s3-c', box: 4, due: '2026-08-09' },
  { id: 'h4-s4-a', box: 4, due: '2026-08-07' },
  { id: 'h4-s4-b', box: 4, due: '2026-08-07' },
  { id: 'h4-s4-c', box: 4, due: today },
  { id: 'h4-s4-d', box: 4, due: '2026-08-05' },

  { id: 'h5-s1', box: 5, due: '2026-08-20' },
  { id: 'h5-s2-a', box: 5, due: '2026-08-17' },
  { id: 'h5-s2-b', box: 5, due: '2026-08-17' },
  { id: 'h5-s3-a', box: 5, due: '2026-08-14' },
  { id: 'h5-s3-b', box: 5, due: '2026-08-14' },
  { id: 'h5-s3-c', box: 5, due: '2026-08-14' },
  { id: 'h5-s4-a', box: 5, due: '2026-08-11' },
  { id: 'h5-s4-b', box: 5, due: '2026-08-11' },
  { id: 'h5-s4-c', box: 5, due: '2026-08-11' },
  { id: 'h5-s4-d', box: 5, due: '2026-08-11' },
  { id: 'h5-s5-a', box: 5, due: '2026-08-08' },
  { id: 'h5-s5-b', box: 5, due: '2026-08-08' },
  { id: 'h5-s5-c', box: 5, due: '2026-08-08' },
  { id: 'h5-s5-d', box: 5, due: '2026-08-08' },
  { id: 'h5-s5-e', box: 5, due: today }
];

words.forEach((word, index) => {
  word.term = word.id;
  word.number = index + 1;
  word.mistakes = word.id === 'h1-b' ? 3 : word.id === 'h1-a' ? 1 : 0;
});

const exportSource = [
  { term: 'alpha', box: 1, mistakes: 0, number: 3 },
  { term: 'ignored-house-two', box: 2, mistakes: 99, number: 1 },
  { term: '  multi\nword  ', box: '1', mistakes: '2', number: 2 },
  { term: 'concession', box: 1, mistakes: 4, number: 1 },
  { term: '   ', box: 1, mistakes: 12, number: 4 }
];
const originalExportOrder = exportSource.map((word) => word.term);
const simpleExport = leitner.buildBoxOneExport(exportSource);
assert.equal(simpleExport, 'concession — 4\nmulti word — 2\nalpha — 0', 'House-one export must include every valid house-one word, ordered by mistakes, with no surrounding prompt');
assert.deepEqual(exportSource.map((word) => word.term), originalExportOrder, 'Building the export must not mutate the learning state order');
assert.doesNotMatch(simpleExport, /خانه|ChatGPT|تمرین|اشتباه/, 'The copied payload must contain only word and number lines');
assert.equal(leitner.buildBoxOneExport(null), '', 'Missing word data must produce an empty export safely');

let clipboardText = null;
const clipboardCopied = await leitner.copyText('concession — 4', {
  navigator: {
    clipboard: {
      async writeText(value) {
        clipboardText = value;
      }
    }
  }
});
assert.equal(clipboardCopied, true, 'Clipboard API success must be reported to the UI');
assert.equal(clipboardText, 'concession — 4', 'Clipboard API must receive the exact simple export text');
assert.equal(await leitner.copyText('', { navigator: {} }), false, 'An empty payload must never attempt to copy');

const expectedByHouse = [
  [2],
  [1, 2],
  [1, 2, 3],
  [1, 0, 2, 0, 3, 0, 4],
  [1, 0, 0, 2, 0, 0, 3, 0, 0, 4, 0, 0, 4, 1]
];

const model = leitner.buildDistribution(words, today, waits);
assert.equal(model.houses.length, 5, 'The distribution must always contain all five Leitner houses');
expectedByHouse.forEach((expectedSegments, index) => {
  const house = model.houses[index];
  assert.equal(house.box, index + 1, `House ${index + 1} must stay in its correct position`);
  assert.deepEqual(house.segments, expectedSegments, `House ${index + 1} must bucket every daily state correctly`);
  assert.equal(house.segments.length, waits[house.box], `House ${house.box} must render one state per waiting day`);
  assert.equal(house.segments.reduce((sum, count) => sum + count, 0), house.total, `House ${house.box} state totals must equal the house total`);
});
assert.equal(model.total, words.length, 'Overall total must equal all words currently stored in houses 1–5');

const emptyModel = leitner.buildDistribution([], today, waits);
assert.equal(emptyModel.total, 0, 'An empty Leitner box must have a zero total');
assert.deepEqual(emptyModel.houses.map((house) => house.segments.length), [1, 2, 3, 7, 14], 'Empty houses must still keep every waiting-day state visible');
assert.ok(emptyModel.houses.every((house) => house.segments.every((count) => count === 0)), 'Every empty house state must display zero');

assert.equal(leitner.segmentIndexForWord({ due: '2026-08-01' }, 5, today, waits), 13, 'Overdue words must stay in the final state until reviewed');
assert.equal(leitner.segmentIndexForWord({ due: null }, 5, today, waits), 0, 'Missing legacy due dates must fall back safely to the first state');
assert.equal(leitner.segmentIndexForWord({ due: null, masteredAt: '2026-08-06T12:00:00.000Z' }, 5, today, waits), 13, 'Mastered house-five words must remain in the final visual state');

const dom = new JSDOM('<div id="root"></div><div id="total"><span data-leitner-total-text></span></div>');
const root = dom.window.document.querySelector('#root');
const total = dom.window.document.querySelector('#total');
leitner.render(root, model);
leitner.updateTotal(total, model.total);

expectedByHouse.forEach((expectedSegments, index) => {
  const houseNumber = index + 1;
  const row = root.querySelector(`[data-house="${houseNumber}"]`);
  assert.ok(row, `House ${houseNumber} row must exist in the DOM`);
  const segments = [...row.querySelectorAll('.leitner-segment')];
  assert.equal(segments.length, expectedSegments.length, `House ${houseNumber} DOM must render every waiting-day state`);
  segments.forEach((segment, segmentIndex) => {
    assert.equal(Number(segment.dataset.stage), segmentIndex + 1, `House ${houseNumber}, state ${segmentIndex + 1} must preserve its state number`);
    assert.equal(Number(segment.dataset.count), expectedSegments[segmentIndex], `House ${houseNumber}, state ${segmentIndex + 1} must show the correct word count`);
    assert.equal(segment.tabIndex, 0, `House ${houseNumber}, state ${segmentIndex + 1} must be keyboard focusable`);
    assert.match(segment.getAttribute('aria-label'), new RegExp(`وضعیت ${faNumber.format(segmentIndex + 1)} از ${faNumber.format(expectedSegments.length)}`), `House ${houseNumber}, state ${segmentIndex + 1} must expose accessible detail`);
  });
});
assert.equal(root.querySelectorAll('.leitner-segment').length, 27, 'The visual must render 1+2+3+7+14 = 27 states');
assert.match(total.textContent, /مجموع: ۳۶ لغت/, 'The total chip must reflect every word in houses 1–5');

const liveDom = new JSDOM(`
  <div class="leitner-panel-head">
    <div><h3>وضعیت خانه‌ها</h3></div>
    <div id="boxDistributionTotal"><span data-leitner-total-text></span></div>
  </div>
  <div id="boxDistribution"></div>
`);
const liveRoot = liveDom.window.document.querySelector('#boxDistribution');
const liveTotal = liveDom.window.document.querySelector('#boxDistributionTotal');
const scheduledFeedback = [];
let copiedHouseOneText = null;
const attachment = leitner.attach({
  document: liveDom.window.document,
  getState: () => ({ words }),
  getToday: () => today,
  MutationObserver: liveDom.window.MutationObserver,
  copyText: async (value) => {
    copiedHouseOneText = value;
    return true;
  },
  setTimeout: (callback, delay) => {
    scheduledFeedback.push({ callback, delay });
    return scheduledFeedback.length;
  },
  clearTimeout: () => {}
});
assert.equal(liveRoot.querySelectorAll('.leitner-segment').length, 27, 'The live dashboard enhancer must render all waiting-day states immediately');
const exportButton = liveDom.window.document.querySelector('#boxOneExportBtn');
assert.ok(exportButton, 'The dashboard enhancer must add the house-one copy button beside the Leitner total');
assert.equal(liveDom.window.document.querySelectorAll('#boxOneExportBtn').length, 1, 'The export control must never be duplicated');
assert.equal(exportButton.nextElementSibling, liveTotal, 'The export button must sit directly beside the Leitner total chip');
assert.equal(exportButton.dataset.wordCount, '2', 'The export button must track every word currently in house one');
assert.equal(exportButton.disabled, false, 'The export button must be usable when house one has words');

exportButton.click();
await new Promise((resolve) => liveDom.window.setTimeout(resolve, 0));
assert.equal(copiedHouseOneText, 'h1-b — 3\nh1-a — 1', 'One click must copy all and only house-one words with their mistake counts');
assert.equal(exportButton.dataset.exportStatus, 'copied', 'Successful copy must provide immediate button feedback');
assert.equal(exportButton.querySelector('[data-box-one-export-label]').textContent, 'کپی شد', 'Successful copy feedback must be visible without adding content to the copied payload');
assert.equal(scheduledFeedback.length, 1, 'Copy feedback must schedule exactly one reset');
assert.equal(scheduledFeedback[0].delay, 1600, 'Copy feedback must reset after the approved short delay');
scheduledFeedback[0].callback();
assert.equal(exportButton.dataset.exportStatus, 'idle', 'Copy feedback must return to the idle state');
assert.equal(exportButton.querySelector('[data-box-one-export-label]').textContent, 'کپی خانه ۱', 'The button label must return to its normal action');

liveRoot.innerHTML = '<div class="box-row">legacy render</div>';
await new Promise((resolve) => liveDom.window.setTimeout(resolve, 0));
assert.equal(liveRoot.querySelector('.box-row'), null, 'A later legacy dashboard render must be replaced by the daily-state visualization');
assert.equal(liveRoot.querySelectorAll('.leitner-segment').length, 27, 'The enhanced visualization must stay synchronized after dashboard refreshes');
assert.equal(liveDom.window.document.querySelectorAll('#boxOneExportBtn').length, 1, 'Dashboard refreshes must not duplicate the export button');
attachment?.destroy?.();

const emptyLiveDom = new JSDOM(`
  <div class="leitner-panel-head">
    <div><h3>وضعیت خانه‌ها</h3></div>
    <div id="boxDistributionTotal"><span data-leitner-total-text></span></div>
  </div>
  <div id="boxDistribution"></div>
`);
const emptyAttachment = leitner.attach({
  document: emptyLiveDom.window.document,
  getState: () => ({ words: words.filter((word) => word.box !== 1) }),
  getToday: () => today,
  MutationObserver: emptyLiveDom.window.MutationObserver
});
const emptyExportButton = emptyLiveDom.window.document.querySelector('#boxOneExportBtn');
assert.equal(emptyExportButton.disabled, true, 'The copy action must be disabled when house one is empty');
assert.equal(emptyExportButton.dataset.wordCount, '0', 'The empty state must expose a zero word count');
emptyAttachment?.destroy?.();

const appSource = fs.readFileSync(new URL('../app-v2.js', import.meta.url), 'utf8');
assert.match(appSource, /const BOX_WAIT_DAYS = \[0, 1, 2, 3, 7, 14\];/, 'The visual state timing must stay aligned with the app scheduling rules');
assert.deepEqual([...waits], [0, 1, 2, 3, 7, 14], 'The visual must use the same wait-day schedule as the learning engine');

const layoutCss = fs.readFileSync(new URL('../leitner-status.css', import.meta.url), 'utf8');
assert.match(layoutCss, /grid-template-columns:\s*minmax\(300px, 1fr\)\s+minmax\(500px, 820px\)/, 'Desktop layout must cap the Leitner card instead of letting it grow across the dashboard');
assert.match(layoutCss, /\.leitner-segments\s*\{[\s\S]*?width:\s*var\(--house-width\);[\s\S]*?max-width:\s*var\(--house-max\);[\s\S]*?justify-self:\s*center;/, 'House states must stay centered and use compact progressive widths');
assert.match(layoutCss, /\.leitner-row\s*\{[\s\S]*?min-height:\s*34px;/, 'Desktop house rows must stay compact');
assert.match(layoutCss, /\.leitner-segment\s*\{[\s\S]*?height:\s*30px;/, 'Desktop state blocks must keep the approved compact height');
assert.match(layoutCss, /\.leitner-state-index\s*\{/, 'Every state must have a persistent visible state-number treatment');
assert.match(layoutCss, /\.leitner-segment\.is-empty\s*\{/, 'Empty states must be visually quieter than occupied states');
assert.match(layoutCss, /\.leitner-segment\.is-occupied\s*\{/, 'Occupied states must be visually distinct');
assert.match(layoutCss, /\.leitner-export-btn\s*\{[\s\S]*?margin-inline-start:\s*auto;[\s\S]*?border-radius:\s*999px;/, 'The house-one export control must stay compact and aligned with the panel chips');
assert.match(layoutCss, /\.leitner-export-btn\.is-copied\s*\{/, 'Successful copying must have a distinct visual confirmation state');
assert.match(layoutCss, /@media \(max-width: 560px\)[\s\S]*?\.leitner-export-btn\s*\{[\s\S]*?order:\s*2;[\s\S]*?margin-inline-start:\s*0;/, 'The export control must wrap cleanly on mobile screens');

const expectedVisualWidths = [
  { percent: 40, max: 250 },
  { percent: 54, max: 340 },
  { percent: 70, max: 440 },
  { percent: 85, max: 535 },
  { percent: 100, max: 630 }
];
const visualWidths = expectedVisualWidths.map((_, index) => {
  const houseNumber = index + 1;
  const match = new RegExp(`\\.leitner-house--${houseNumber}\\s*\\{([\\s\\S]*?)\\}`, 'm').exec(layoutCss);
  assert.ok(match, `House ${houseNumber} must define its own visual width`);
  const percent = Number(/--house-width:\s*(\d+)%/.exec(match[1])?.[1]);
  const max = Number(/--house-max:\s*(\d+)px/.exec(match[1])?.[1]);
  return { percent, max };
});
assert.deepEqual(visualWidths, expectedVisualWidths, 'House 1–5 visual groups must grow progressively like the approved mockup');
for (let index = 1; index < visualWidths.length; index += 1) {
  assert.ok(visualWidths[index].percent > visualWidths[index - 1].percent, `House ${index + 1} must be wider than House ${index}`);
  assert.ok(visualWidths[index].max > visualWidths[index - 1].max, `House ${index + 1} maximum width must be wider than House ${index}`);
}

console.log('Leitner status distribution and house-one export tests passed.');
