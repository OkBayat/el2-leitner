import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const template = fs.readFileSync(
  path.join(uiRoot, 'src/app/features/bbc-listening/bbc-listening-practice-page.component.html'),
  'utf8',
);

const actions = template.match(/<div class="listening-levels">([\s\S]*?)<\/div>/u)?.[1] ?? '';

assert.match(
  actions,
  /data-testid="episode-vocabulary-link"/u,
  'Episode vocabulary must remain in the listening header action row.',
);
assert.match(
  actions,
  /<voco-secondary-link[\s\S]*?data-testid="open-bbc-episode"[\s\S]*?\[href\]="lesson\.sourceUrl"/u,
  'The BBC source must use the shared secondary link inside the listening header action row.',
);
assert.match(actions, /target="_blank"/u, 'The BBC source must open in a new tab.');
assert.match(actions, /rel="noopener noreferrer"/u, 'The BBC source must keep safe external-link attributes.');
assert.match(
  actions,
  /<span class="external-link-icon" aria-hidden="true">↗<\/span>/u,
  'The BBC source action must show one external-link icon.',
);
assert.doesNotMatch(
  template,
  /<voco-primary-link[\s\S]*?\[href\]="lesson\.sourceUrl"/u,
  'The BBC source must not return as the separate primary header CTA.',
);
