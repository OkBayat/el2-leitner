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

const expectedByHouse = [
  [2],
  [1, 2],
  [1, 2, 3],
  [1, 2, 3, 4],
  [1, 2, 3, 4, 5]
];

const model = leitner.buildDistribution(words, today, waits);
assert.equal(model.houses.length, 5, 'The distribution must always contain all five Leitner houses');
expectedByHouse.forEach((expectedSegments, index) => {
  const house = model.houses[index];
  assert.equal(house.box, index + 1, `House ${index + 1} must stay in its correct position`);
  assert.deepEqual(house.segments, expectedSegments, `House ${index + 1} must bucket every section correctly`);
  assert.equal(house.segments.length, house.box, `House ${house.box} must render exactly ${house.box} sections`);
  assert.equal(house.segments.reduce((sum, count) => sum + count, 0), house.total, `House ${house.box} section totals must equal the house total`);
});
assert.equal(model.total, words.length, 'Overall total must equal all words currently stored in houses 1–5');

const emptyModel = leitner.buildDistribution([], today, waits);
assert.equal(emptyModel.total, 0, 'An empty Leitner box must have a zero total');
assert.deepEqual(emptyModel.houses.map((house) => house.segments.length), [1, 2, 3, 4, 5], 'Empty houses must still keep their complete visual structure');
assert.ok(emptyModel.houses.every((house) => house.segments.every((count) => count === 0)), 'Every empty house section must display zero');

assert.equal(leitner.segmentIndexForWord({ due: '2026-08-01' }, 5, today, waits), 4, 'Overdue words must stay in the final section until reviewed');
assert.equal(leitner.segmentIndexForWord({ due: null }, 5, today, waits), 0, 'Missing legacy due dates must fall back safely to the first section');

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
  assert.equal(segments.length, houseNumber, `House ${houseNumber} DOM must have exactly ${houseNumber} visual sections`);
  segments.forEach((segment, segmentIndex) => {
    assert.equal(Number(segment.dataset.stage), segmentIndex + 1, `House ${houseNumber}, section ${segmentIndex + 1} must preserve its stage number`);
    assert.equal(Number(segment.dataset.count), expectedSegments[segmentIndex], `House ${houseNumber}, section ${segmentIndex + 1} must show the correct word count`);
    assert.equal(segment.tabIndex, 0, `House ${houseNumber}, section ${segmentIndex + 1} must be keyboard focusable`);
    assert.match(segment.getAttribute('aria-label'), new RegExp(`بخش ${faNumber.format(segmentIndex + 1)} از ${faNumber.format(houseNumber)}`), `House ${houseNumber}, section ${segmentIndex + 1} must expose accessible detail`);
  });
});
assert.equal(root.querySelectorAll('.leitner-segment').length, 15, 'The visual must render 1+2+3+4+5 = 15 sections');
assert.match(total.textContent, /مجموع: ۳۶ لغت/, 'The total chip must reflect every word in houses 1–5');

const liveDom = new JSDOM('<div id="boxDistribution"></div><div id="boxDistributionTotal"><span data-leitner-total-text></span></div>');
const liveRoot = liveDom.window.document.querySelector('#boxDistribution');
const attachment = leitner.attach({
  document: liveDom.window.document,
  getState: () => ({ words }),
  getToday: () => today,
  MutationObserver: liveDom.window.MutationObserver
});
assert.equal(liveRoot.querySelectorAll('.leitner-segment').length, 15, 'The live dashboard enhancer must render the complete visualization immediately');
liveRoot.innerHTML = '<div class="box-row">legacy render</div>';
await new Promise((resolve) => liveDom.window.setTimeout(resolve, 0));
assert.equal(liveRoot.querySelector('.box-row'), null, 'A later legacy dashboard render must be replaced by the segmented visualization');
assert.equal(liveRoot.querySelectorAll('.leitner-segment').length, 15, 'The enhanced visualization must stay synchronized after dashboard refreshes');
attachment?.observer?.disconnect();

const appSource = fs.readFileSync(new URL('../app-v2.js', import.meta.url), 'utf8');
assert.match(appSource, /const BOX_WAIT_DAYS = \[0, 1, 2, 3, 7, 14\];/, 'The visual section timing must stay aligned with the app scheduling rules');
assert.deepEqual([...waits], [0, 1, 2, 3, 7, 14], 'The visual must use the same wait-day schedule as the learning engine');

console.log('Leitner status distribution tests passed.');
