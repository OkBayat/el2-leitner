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

assert.match(pageTs, /templateUrl:\s*'library-page\.component\.html'/u, 'Library markup must have a dedicated template owner.');
assert.match(pageTs, /styleUrl:\s*'library-page\.component\.scss'/u, 'Library styling must have a dedicated stylesheet owner.');
assert.equal((pageHtml.match(/data-testid="library-section"/gu) ?? []).length, 3, 'Library must have exactly three content sections.');
for (const heading of ['My Courses and Collections', 'All Courses', 'All Collections']) {
  assert.ok(pageHtml.includes(`>${heading}</h2>`), `Library must include the ${heading} section.`);
}
assert.match(pageHtml, /data-testid="library-my-items"/u, 'Active courses and Leitner collections need a stable list.');
assert.match(pageHtml, /data-testid="library-all-courses"/u, 'All courses need a stable list.');
assert.match(pageHtml, /data-testid="library-all-collections"/u, 'All collections need a stable list.');
assert.doesNotMatch(pageHtml, /mat-form-field|mat-select|Search|Filter/u, 'Library must not add search or filter controls.');
assert.doesNotMatch(pageHtml, /description|wordCount|mat-progress-bar|progress|tag/u, 'Library items must contain names only.');
assert.match(pageTs, /localeCompare/u, 'Library lists must use alphabetical ordering.');
assert.match(pageTs, /router\.navigate\(\['\/library', collection\.id\]\)/u, 'Every item must open the existing detail route.');
assert.match(pageTs, /dialogs\.open\(CollectionEditorComponent/u, 'Creating a collection must keep using the collection editor.');
assert.match(pageTs, /api\.create\(value\)/u, 'The New collection action must still persist the new collection.');
assert.match(routes, /path:\s*'library\/:id'/u, 'The app shell must retain the dedicated details route.');

assert.match(pageStyles, /grid-template-columns:\s*minmax\(0, 1fr\)/u, 'Library must begin with a one-column mobile layout.');
assert.match(pageStyles, /min-height:\s*56px/u, 'Library items must have large touch targets.');
assert.match(pageHtml, /vocoButtonInteraction/u, 'Library items must use the shared voco interaction primitive.');
assert.match(pageHtml, /w-100 d-flex justify-content-start align-items-center text-start text-truncate/u, 'Library item layout must use Bootstrap utilities.');
assert.doesNotMatch(pageStyles, /\.library-item:hover|\.library-item:focus-visible/u, 'Feature styles must not reskin Material hover or focus states.');
assert.match(pageStyles, /@media \(min-width:\s*720px\)/u, 'Library layout must be mobile-first.');

assert.match(detailPage, /data-testid="library-detail-page"/u, 'Collection details need a stable page locator.');
assert.match(detailPage, /← Back to library/u, 'Collection details must expose an explicit return action.');
assert.match(detailPage, /mat-chip>\{\{ kindLabel\(c\.kind\) \}\}<\/mat-chip>/u, 'Details must retain collection type metadata.');
assert.match(detailPage, /mat-chip>\{\{ level\(c\) \}\}<\/mat-chip>/u, 'Details must retain CEFR metadata.');
assert.match(detailPage, /version \{\{ c\.contentVersion \}\}/u, 'Details must retain version metadata.');
assert.match(detailPage, /'Start Course'/u, 'Course details must expose the explicit Start Course copy.');
assert.match(detailPage, /'Add to Leitner Only'/u, 'Details must expose the explicit Leitner-only copy.');
assert.match(detailPage, /This will not start the course or add it to your learning path\./u, 'Course actions must explain independent Leitner behavior.');
for (const action of ['Edit collection', 'Import file', 'Add word']) {
  assert.ok(detailPage.includes(`>${action}</voco-secondary-button>`), `Details must preserve the ${action} action.`);
}
assert.match(detailPage, /LibraryEntryDialogComponent/u, 'Details must preserve add/edit-word dialogs.');
assert.match(detailPage, /api\.updateEntry/u, 'Details must preserve word editing.');
assert.match(detailPage, /api\.addEntry/u, 'Details must preserve adding individual words.');
assert.match(detailPage, /ConfirmDialogComponent/u, 'Details must preserve delete confirmation.');
assert.match(detailPage, /api\.removeEntry/u, 'Details must preserve deleting words.');
assert.match(detailPage, /matColumnDef="term"/u, 'Details must preserve the word column.');
assert.match(detailPage, /matColumnDef="section"/u, 'Details must preserve the section column.');

console.log('Library catalog and detail-action design contract passed.');
