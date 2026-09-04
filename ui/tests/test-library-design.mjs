import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');

const pageTs = read('src/app/features/library/library-page.component.ts');
const pageHtml = read('src/app/features/library/library-page.component.html');
const pageStyles = read('src/app/features/library/library-page.component.scss');
const coverHelper = read('src/app/features/library/library-cover.ts');
const coverSpec = read('src/app/features/library/library-cover.spec.ts');
const coverReadme = read('assets/library/covers/README.md');

assert.match(pageTs, /templateUrl:\s*'library-page\.component\.html'/u, 'Library markup must have a dedicated template owner.');
assert.match(pageTs, /styleUrl:\s*'library-page\.component\.scss'/u, 'Library styling must have a dedicated stylesheet owner.');
assert.match(pageHtml, /data-testid="library-card-grid"/u, 'Library cards need a stable grid regression locator.');
assert.match(pageHtml, /data-testid="library-collection-cover"/u, 'Every collection card must expose the cover region.');
assert.match(pageHtml, /\[src\]="coverUrl\(collection\)"/u, 'Collection cover images must come from the stable cover helper.');
assert.match(pageHtml, /\(error\)="markCoverMissing\(collection\.slug\)"/u, 'Missing cover assets must fall back without rendering a broken image.');
assert.match(pageHtml, /class="cover-fallback"/u, 'A CSS-designed fallback must always sit underneath the optional image.');
assert.match(pageHtml, /class="cover-badge"/u, 'The compact collection type and level must live on the cover instead of a dense subtitle row.');
assert.doesNotMatch(pageHtml, /version\s*\{\{/u, 'Collection version metadata must not clutter the browsing card.');
assert.doesNotMatch(pageHtml, /class="stats"/u, 'The old three-card statistics strip must not return to the Library page.');

assert.match(coverHelper, /assets\/library\/covers/u, 'Library covers must live under the documented assets directory.');
assert.match(coverHelper, /encodeURIComponent\(slug\)/u, 'The unique collection slug must be safely encoded into the asset filename.');
assert.match(coverHelper, /\.webp/u, 'Library covers must use one predictable WebP filename convention.');
assert.match(coverSpec, /business-vocabulary-in-use-elementary\.webp/u, 'Unit coverage must lock the slug-based naming convention.');
assert.match(coverSpec, /\.\.%2Fprivate%20cover/u, 'Unit coverage must prevent path traversal through collection slugs.');

assert.match(pageStyles, /\.collection-cover\s*\{/u, 'Library cards must reserve a dedicated visual cover area.');
assert.match(pageStyles, /radial-gradient|linear-gradient/u, 'The missing-image state must be intentionally designed in CSS.');
assert.match(pageStyles, /object-fit:\s*cover/u, 'Uploaded collection artwork must crop consistently inside the card cover.');
assert.match(pageStyles, /-webkit-line-clamp:\s*3/u, 'Long descriptions must stay compact instead of stretching cards vertically.');
assert.match(pageStyles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/u, 'Wide screens must preserve a clean three-column Library grid.');
assert.match(pageStyles, /@media \(max-width:\s*760px\)[\s\S]*grid-template-columns:\s*1fr/u, 'Library cards and filters must collapse cleanly on phones.');

assert.match(coverReadme, /<collection\.slug>\.webp/u, 'The assets directory must document the exact filename contract.');
assert.match(coverReadme, /1200 × 675/u, 'The cover documentation must state the recommended image size.');
assert.match(coverReadme, /CSS-designed fallback/u, 'The cover documentation must explain the no-image behavior.');

console.log('Library cover-card design contract passed.');
