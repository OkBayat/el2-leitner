import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');

const template = read('src/app/features/bbc-listening/bbc-lessons-page.component.html');
const styles = read('src/app/features/bbc-listening/bbc-lessons-page.component.scss');

assert.doesNotMatch(
  template,
  /class="test-title"/u,
  'Catalog test buttons must not render the verbose test title.',
);
assert.match(
  template,
  /\[attr\.aria-label\]="test\.title[\s\S]*?difficultyLabel\(test\.difficulty\)[\s\S]*?Completed[\s\S]*?Start/u,
  'Compact test buttons must keep the hidden test context for assistive technology.',
);
assert.match(
  template,
  /class="test-button-content"[\s\S]*?class="difficulty-badge"[\s\S]*?class="test-status"/u,
  'Each compact test button must show only difficulty and state.',
);

const secondaryActionsStart = template.indexOf('class="lesson-secondary-actions"');
const testsStart = template.indexOf('class="lesson-tests"');
assert.ok(secondaryActionsStart >= 0 && secondaryActionsStart < testsStart, 'Episode actions must render below lesson copy and before the test picker.');
const secondaryActions = template.slice(secondaryActionsStart, testsStart);
assert.match(secondaryActions, /episode-vocabulary-link/u, 'Episode vocabulary must stay with the lesson text.');
assert.match(secondaryActions, /\[href\]="lesson\.sourceUrl"/u, 'The BBC source link must stay with the lesson text.');

assert.match(template, /loading="lazy"/u, 'Episode covers must remain lazy-loaded.');
assert.match(template, /fetchpriority="low"/u, 'Episode covers must not compete with primary catalog content while loading.');
assert.match(styles, /\.lesson-card\.has-cover[\s\S]*?padding:\s*0/u, 'Cover cards must allow the image rail to reach the card edges.');
assert.match(styles, /\.lesson-cover[\s\S]*?height:\s*100%/u, 'The cover image must fill the card from top to bottom on desktop.');
assert.match(styles, /\.lesson-cover[\s\S]*?object-fit:\s*cover/u, 'The cover image must fill its rail without distortion.');
