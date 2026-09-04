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
const detailPage = read('src/app/features/library/library-detail-page.component.ts');
const routes = read('src/app/app.routes.ts');
const coverHelper = read('src/app/features/library/library-cover.ts');
const coverSpec = read('src/app/features/library/library-cover.spec.ts');
const coverReadme = read('assets/library/covers/README.md');

assert.match(pageTs, /templateUrl:\s*'library-page\.component\.html'/u, 'Library markup must have a dedicated template owner.');
assert.match(pageTs, /styleUrl:\s*'library-page\.component\.scss'/u, 'Library styling must have a dedicated stylesheet owner.');
assert.match(pageHtml, /data-testid="library-added-card-grid"/u, 'Added collections need their own stable grid.');
assert.match(pageHtml, /data-testid="library-available-card-grid"/u, 'Available collections need their own stable grid.');
assert.match(pageHtml, />My collections</u, 'Subscribed collections must be grouped first.');
assert.match(pageHtml, />Available collections</u, 'Unsubscribed collections must be grouped separately.');
assert.match(pageHtml, /data-testid="library-collection-cover"/u, 'Every collection card must expose the cover region.');
assert.match(pageHtml, /\[src\]="coverUrl\(collection\)"/u, 'Collection cover images must come from the stable cover helper.');
assert.match(pageHtml, /\(error\)="markCoverMissing\(collection\.slug\)"/u, 'Missing cover assets must fall back without rendering a broken image.');
assert.match(pageHtml, /class="cover-fallback"/u, 'A CSS-designed fallback must always sit underneath the optional image.');
assert.doesNotMatch(pageHtml, /cover-monogram/u, 'Fallback covers must stay decorative without generated initials.');
assert.match(pageHtml, /class="cover-badge"/u, 'The compact collection type and level must live on the cover instead of a dense subtitle row.');
assert.doesNotMatch(pageHtml, /version\s*\{\{/u, 'Collection version metadata must not clutter the browsing card.');
assert.doesNotMatch(pageHtml, /class="stats"/u, 'The old three-card statistics strip must not return to the Library page.');
assert.match(pageHtml, />View details</u, 'Collection cards must navigate to a dedicated details page.');
assert.doesNotMatch(pageHtml, /cover-edit|Edit collection/u, 'Admin editing must not live on the browsing cards.');
assert.match(pageTs, /router\.navigate\(\['\/library', collection\.id\]\)/u, 'View details must navigate to the collection route instead of opening the legacy detail popup.');
assert.match(pageTs, /dialogs\.open\(CollectionEditorComponent/u, 'Creating a collection must keep using the collection editor.');
assert.match(pageTs, /api\.create\(value\)/u, 'The New collection action must still persist the new collection.');
assert.match(pageTs, /router\.navigate\(\['\/library', result\.collection\.id\]\)/u, 'A newly created collection should open in its details page.');
assert.match(routes, /path:\s*'library\/:id'/u, 'The app shell must own a dedicated collection details route.');

assert.match(detailPage, /data-testid="library-detail-page"/u, 'Collection details need a stable page locator.');
assert.match(detailPage, /← Back to library/u, 'Collection details must expose an explicit return action.');
assert.match(detailPage, /mat-chip>\{\{ kindLabel\(c\.kind\) \}\}<\/mat-chip>/u, 'Details must keep the collection type metadata from the former popup.');
assert.match(detailPage, /mat-chip>\{\{ level\(c\) \}\}<\/mat-chip>/u, 'Details must keep the CEFR metadata from the former popup.');
assert.match(detailPage, /mat-chip>\{\{ c\.status \}\}<\/mat-chip>/u, 'Details must keep collection status metadata from the former popup.');
assert.match(detailPage, /version \{\{ c\.contentVersion \}\}/u, 'Details must keep collection version metadata from the former popup.');
assert.match(detailPage, /Remove from box' : 'Add to box/u, 'Details must preserve subscription controls.');
for (const action of ['Edit collection', 'Import file', 'Add word']) {
  assert.ok(detailPage.includes(`>${action}</button>`), `Details must preserve the ${action} action from the former popup.`);
}
assert.match(detailPage, /LibraryEntryDialogComponent/u, 'Details must preserve add/edit-word dialogs.');
assert.match(detailPage, /api\.updateEntry/u, 'Details must preserve word editing.');
assert.match(detailPage, /api\.addEntry/u, 'Details must preserve adding individual words.');
assert.match(detailPage, /ConfirmDialogComponent/u, 'Details must preserve delete confirmation.');
assert.match(detailPage, /api\.removeEntry/u, 'Details must preserve deleting words.');
assert.match(detailPage, /matColumnDef="term"/u, 'Details must preserve the word column from the popup table.');
assert.match(detailPage, /matColumnDef="section"/u, 'Details must preserve the section column from the popup table.');
assert.match(detailPage, /editEntry\(entry\)/u, 'Each manageable word must retain its edit action.');
assert.match(detailPage, /removeEntry\(entry\)/u, 'Each manageable word must retain its delete action.');

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

console.log('Library cover-card and full-detail-page design contract passed.');
