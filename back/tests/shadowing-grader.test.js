import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeShadowing } from '../src/domain/shadowing-practice/ShadowingGrader.js';

test('matches words in order without shifting after an omission', () => {
  const result = gradeShadowing('I really want to go home.', 'I want to go home');
  assert.deepEqual(result.words.map(w => w.matched), [true, false, true, true, true, true]);
  assert.equal(result.matchedCount, 5);
  assert.equal(result.passed, false);
});
test('keeps punctuation, spacing and case in the displayed sentence', () => {
  const target = '  Hello, world!  How are you?';
  const result = gradeShadowing(target, 'hello world how are you');
  assert.equal(result.leading + result.words.map(w => w.text + w.after).join(''), target);
  assert.equal(result.score, 100);
});
test('normalizes contractions without ignoring a missing negation', () => {
  assert.equal(gradeShadowing("Haven’t we destroyed enough planets already?", 'have not we destroyed enough planets already').score, 100);
  assert.equal(gradeShadowing("I can't go.", 'i can go').words[1].matched, false);
});
test('a repeated word cannot earn credit more than once', () => {
  assert.equal(gradeShadowing('I think that that is right.', 'i think that is right').matchedCount, 5);
  assert.equal(gradeShadowing('one two three four', 'four three two one').passed, false);
});
test('uses an unrounded ninety-percent threshold', () => {
  assert.equal(gradeShadowing('a b c d e f g h i j', 'a b c d e f g h i').passed, true);
  assert.equal(gradeShadowing('a b c d e f g h i', 'a b c d e f g h').passed, false);
});
test('does not equate different words or grammatical forms', () => {
  assert.equal(gradeShadowing('The planets are blue.', 'the planet is blue').matchedCount, 2);
});
test('handles common spelling variants and small numerals', () => {
  assert.equal(gradeShadowing('I have 2 colour pencils.', 'i have two color pencils').score, 100);
});
test('empty speech never passes and unreasonable inputs are bounded', () => {
  assert.equal(gradeShadowing('Hello world.', '').passed, false);
  assert.equal(gradeShadowing('', 'hello').passed, false);
  assert.throws(() => gradeShadowing('a '.repeat(81), 'a'), /too long/i);
  assert.throws(() => gradeShadowing('a', 'a '.repeat(401)), /too long/i);
});
