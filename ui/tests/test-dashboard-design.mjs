import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');

const dashboardTs = read('src/app/features/dashboard/dashboard-page.component.ts');
const dashboardHtml = read('src/app/features/dashboard/dashboard-page.component.html');
const dashboardStyles = read('src/app/features/dashboard/dashboard-page.component.scss');
const shellTs = read('src/app/shared/app-shell/app-shell.component.ts');
const shellHtml = read('src/app/shared/app-shell/app-shell.component.html');
const shellStyles = read('src/app/shared/app-shell/app-shell.component.scss');

assert.match(dashboardTs, /templateUrl:\s*'dashboard-page\.component\.html'/u, 'Dashboard markup should have one dedicated template owner.');
assert.match(dashboardTs, /styleUrl:\s*'dashboard-page\.component\.scss'/u, 'Dashboard layout should have one dedicated style owner.');
assert.match(dashboardTs, /houseWidths = \[40, 54, 70, 85, 100\] as const/u, 'Leitner house widths must preserve the approved pyramid progression.');
assert.match(dashboardHtml, /\[style\.width\.%\]="houseWidths\[house\.box - 1\]"/u, 'Every Leitner row must derive its visual width from the pyramid contract.');
assert.match(dashboardHtml, /data-testid="house-status"/u, 'House status needs its stable regression locator.');
assert.match(dashboardHtml, />Today's plan</u, 'The current dashboard E2E contract must keep the Today plan label.');
assert.match(dashboardHtml, /Today's progress/u, 'The minimal dashboard must expose the compact daily progress summary.');
assert.match(dashboardHtml, /Words in Leitner/u, 'The summary row must expose total active Leitner words.');
assert.equal(dashboardHtml.match(/class="leitner-row"/gu)?.length, 1, 'One template loop must own all five Leitner rows.');

assert.match(shellTs, /MatMenuModule/u, 'The compact hamburger/account navigation should use Angular Material menus.');
assert.match(shellHtml, /class="topbar"/u, 'The application shell must use the minimal top bar.');
assert.match(shellHtml, /class="product-tabs"/u, 'Primary destinations must remain visible as compact top tabs.');
assert.doesNotMatch(shellHtml, /mat-sidenav|sidebar-progress|mobile-nav/u, 'The redesigned shell must not restore the old permanent sidebar or floating bottom nav.');

for (const [name, styles] of [
	['dashboard', dashboardStyles],
	['shell', shellStyles],
]) {
	assert.doesNotMatch(styles, /linear-gradient|radial-gradient/u, `${name} must stay flat rather than returning to decorative gradients.`);
	assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/iu, `${name} must use Material system roles instead of a local color palette.`);
	assert.match(styles, /var\(--mat-sys-/u, `${name} must remain owned by Material 3 system roles.`);
}

assert.match(dashboardStyles, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/u, 'Desktop summary metrics must remain a compact four-column strip.');
assert.match(dashboardStyles, /@media\(max-width:\s*640px\)/u, 'Dashboard must keep an explicit phone layout.');
assert.match(shellStyles, /overflow-x:\s*auto/u, 'Top navigation must remain usable on narrow screens.');

console.log('Minimal dashboard design contract passed.');
