import fs from 'node:fs';
import assert from 'node:assert/strict';

await import('../leitner-status.js');
const leitner = globalThis.VocoraLeitnerStatus;
assert.ok(leitner, 'Leitner status module must expose its testable API');

const today = '2026-08-06';
const waits = leitner.DEFAULT_WAIT_DAYS;

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

const model = leitner.buildDistribution(words, today, waits);
assert.deepEqual(model.houses[0].segments, [2], 'House 1 must contain exactly one section and count every box-1 word');
assert.deepEqual(model.houses[1].segments, [1, 2], 'House 2 must contain two correctly bucketed sections');
assert.deepEqual(model.houses[2].segments, [1, 2, 3], 'House 3 must contain three correctly bucketed sections');
assert.deepEqual(model.houses[3].segments, [1, 2, 3, 4], 'House 4 must contain four correctly bucketed sections');
assert.deepEqual(model.houses[4].segments, [1, 2, 3, 4, 5], 'House 5 must contain five correctly bucketed sections');

model.houses.forEach((house) => {
  assert.equal(house.segments.length, house.box, `House ${house.box} must render exactly ${house.box} sections`);
  assert.equal(house.segments.reduce((sum, count) => sum + count, 0), house.total, `House ${house.box} section totals must equal the house total`);
});
assert.equal(model.total, words.length, 'Overall total must equal all words currently stored in houses 1–5');

assert.equal(leitner.segmentIndexForWord({ due: '2026-08-01' }, 5, today, waits), 4, 'Overdue words must stay in the final section until reviewed');
assert.equal(leitner.segmentIndexForWord({ due: null }, 5, today, waits), 0, 'Missing legacy due dates must fall back safely to the first section');

const markup = leitner.renderDistributionHtml(model);
for (let box = 1; box <= 5; box += 1) {
  assert.match(markup, new RegExp(`data-house="${box}"`), `House ${box} row must be present in the rendered markup`);
}
assert.equal((markup.match(/class="leitner-segment /g) || []).length, 15, 'The visual must render 1+2+3+4+5 = 15 sections');
assert.match(markup, /data-tooltip="خانه ۵ · بخش ۵ از ۵ · ۵ لغت"/, 'Every section must expose its count in an accessible hover tooltip');

const appSource = fs.readFileSync(new URL('../app-v2.js', import.meta.url), 'utf8');
assert.match(appSource, /const BOX_WAIT_DAYS = \[0, 1, 2, 3, 7, 14\];/, 'The visual section timing must stay aligned with the app scheduling rules');
assert.deepEqual([...waits], [0, 1, 2, 3, 7, 14], 'The visual must use the same wait-day schedule as the learning engine');

console.log('Leitner status distribution tests passed.');
