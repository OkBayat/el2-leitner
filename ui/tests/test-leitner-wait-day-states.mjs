import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

await import('../leitner-status.js');
const leitner = globalThis.VocoraLeitnerStatus;
assert.ok(leitner, 'Leitner status module must expose its testable API');

const today = '2026-08-06';
const waits = leitner.DEFAULT_WAIT_DAYS;
const assetVersion = 'wait-day-states-v1';

function addDays(day, amount) {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, date + amount));
  return value.toISOString().slice(0, 10);
}

function wordsForEveryState(box) {
  const stateCount = waits[box];
  return Array.from({ length: stateCount }, (_, index) => ({
    id: `h${box}-state-${index + 1}`,
    term: `h${box}-state-${index + 1}`,
    box,
    due: addDays(today, stateCount - index),
    mistakes: 0,
    number: box * 100 + index
  }));
}

assert.deepEqual([...waits], [0, 1, 2, 3, 7, 14], 'UI state counts must come from the real Leitner waiting schedule');

const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(
  indexSource,
  new RegExp(`href="leitner-status\\.css\\?v=${assetVersion}"`),
  'Regression: the dashboard must request the revised Leitner stylesheet with a new cache key'
);
assert.match(
  indexSource,
  new RegExp(`src="leitner-status\\.js\\?v=${assetVersion}"`),
  'Regression: the dashboard must request the revised Leitner runtime with a new cache key instead of reusing the old five-state asset'
);

const empty = leitner.buildDistribution([], today, waits);
assert.deepEqual(
  empty.houses.map((house) => house.segments.length),
  [1, 2, 3, 7, 14],
  'Regression: houses must expose one visual state for every waiting day, especially 7 states in house 4 and 14 in house 5'
);

const words = [1, 2, 3, 4, 5].flatMap(wordsForEveryState);
const model = leitner.buildDistribution(words, today, waits);

model.houses.forEach((house) => {
  assert.equal(house.segments.length, waits[house.box], `House ${house.box} must have exactly ${waits[house.box]} daily states`);
  assert.deepEqual(house.segments, Array(waits[house.box]).fill(1), `House ${house.box} must map one word into each daily state without merging days`);
});

assert.equal(leitner.segmentIndexForWord({ due: addDays(today, 7) }, 4, today, waits), 0, 'A word entering house 4 must start in state 1 of 7');
assert.equal(leitner.segmentIndexForWord({ due: addDays(today, 4) }, 4, today, waits), 3, 'House 4 must advance one visible state per elapsed day');
assert.equal(leitner.segmentIndexForWord({ due: addDays(today, 1) }, 4, today, waits), 6, 'The day before a house-4 review must be state 7 of 7');
assert.equal(leitner.segmentIndexForWord({ due: today }, 4, today, waits), 6, 'A due house-4 word must remain in its final state until reviewed');

assert.equal(leitner.segmentIndexForWord({ due: addDays(today, 14) }, 5, today, waits), 0, 'A word entering house 5 must start in state 1 of 14');
assert.equal(leitner.segmentIndexForWord({ due: addDays(today, 8) }, 5, today, waits), 6, 'House 5 must expose the seventh daily state instead of compressing it into five buckets');
assert.equal(leitner.segmentIndexForWord({ due: addDays(today, 1) }, 5, today, waits), 13, 'The day before a house-5 review must be state 14 of 14');
assert.equal(leitner.segmentIndexForWord({ due: addDays(today, -3) }, 5, today, waits), 13, 'Overdue house-5 words must stay in state 14 until reviewed');

const dom = new JSDOM('<div id="root"></div>');
const root = dom.window.document.querySelector('#root');
leitner.render(root, model);

assert.equal(root.querySelectorAll('.leitner-segment').length, 27, 'The full visualization must render 1+2+3+7+14 = 27 states');
assert.equal(root.querySelector('[data-house="4"]').querySelectorAll('.leitner-segment').length, 7, 'House 4 DOM must render all seven states');
assert.equal(root.querySelector('[data-house="5"]').querySelectorAll('.leitner-segment').length, 14, 'House 5 DOM must render all fourteen states');

const houseFiveStates = [...root.querySelectorAll('[data-house="5"] .leitner-segment')];
houseFiveStates.forEach((segment, index) => {
  const state = index + 1;
  assert.equal(segment.dataset.stage, String(state), `House 5 state ${state} must retain its explicit state number`);
  assert.equal(segment.querySelector('.leitner-state-index')?.textContent, new Intl.NumberFormat('fa-IR').format(state), `House 5 state ${state} must show its state number without requiring hover`);
  assert.match(segment.getAttribute('aria-label') || '', new RegExp(`وضعیت ${new Intl.NumberFormat('fa-IR').format(state)} از ۱۴`), `House 5 state ${state} must expose the exact state in accessible text`);
  assert.equal(segment.classList.contains('is-occupied'), true, `House 5 state ${state} with words must be visually marked as occupied`);
});

console.log('Leitner wait-day state regression and unit tests passed.');
