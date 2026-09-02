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
assert.match(dashboardTs, /label: 'Words in Leitner'/u, 'The summary row must expose total active Leitner words.');
assert.equal(dashboardHtml.match(/class="leitner-row"/gu)?.length, 1, 'One template loop must own all five Leitner rows.');

assert.match(shellTs, /MatMenuModule/u, 'The compact hamburger/account navigation should use Angular Material menus.');
assert.match(shellHtml, /class="topbar"/u, 'The application shell must use the minimal top bar.');
assert.match(shellHtml, /class="product-tabs"/u, 'Primary destinations must remain visible as compact top tabs on larger screens.');
assert.match(shellHtml, /class="mobile-nav"/u, 'Phones must restore the base branch bottom navigation.');
assert.match(shellHtml, /@for \(item of primaryNavItems; track item\.path\)/u, 'Desktop and mobile navigation must reuse the same primary destination model.');
assert.doesNotMatch(shellHtml, /mat-sidenav|sidebar-progress/u, 'The redesigned shell must not restore the old permanent desktop sidebar.');
assert.match(shellTs, /@HostListener\('window:scroll'\)/u, 'Mobile chrome visibility must react through Angular scroll handling.');
assert.match(shellTs, /delta >= MOBILE_NAV_SCROLL_THRESHOLD[\s\S]*mobileNavHidden\.set\(true\)/u, 'Scrolling down must hide the mobile chrome.');
assert.match(shellTs, /delta <= -MOBILE_NAV_SCROLL_THRESHOLD[\s\S]*mobileNavHidden\.set\(false\)/u, 'Scrolling up must reveal the mobile chrome.');
assert.match(shellTs, /currentScrollY <= MOBILE_NAV_TOP_SAFE_ZONE[\s\S]*mobileNavHidden\.set\(false\)/u, 'Mobile chrome must remain visible at the top of the page.');
assert.ok((shellHtml.match(/\[class\.is-hidden\]="mobileNavHidden\(\)"/gu) || []).length >= 2, 'Header and bottom navigation must share one scroll-visibility signal.');
assert.match(shellHtml, /<header[\s\S]*\[attr\.aria-hidden\]="mobileNavHidden\(\) \? 'true' : null"[\s\S]*\[attr\.inert\]="mobileNavHidden\(\) \? '' : null"/u, 'Hidden mobile header controls must leave the accessibility and focus trees.');
assert.match(shellHtml, /<nav[\s\S]*class="mobile-nav"[\s\S]*\[attr\.aria-hidden\]="mobileNavHidden\(\) \? 'true' : null"/u, 'The hidden bottom navigation must leave the accessibility tree.');
assert.match(shellHtml, /\[attr\.tabindex\]="mobileNavHidden\(\) \? -1 : null"/u, 'Hidden mobile navigation links must leave the keyboard tab order.');

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
assert.match(shellStyles, /overflow-x:\s*auto/u, 'Desktop/tablet top navigation must remain usable when space is constrained.');
assert.match(shellStyles, /@media\(max-width:\s*640px\)[\s\S]*\.product-tabs\s*\{[\s\S]*display:\s*none/u, 'Top navigation must be hidden on phones.');
assert.match(shellStyles, /\.topbar\.is-hidden\s*\{[\s\S]*translateY\(calc\(-100% - 1px\)\)/u, 'Hidden phone header must slide above the viewport instead of disappearing abruptly.');
assert.match(shellStyles, /\.mobile-nav\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*8px/u, 'Phone navigation must stay fixed at the bottom like the base branch.');
assert.match(shellStyles, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/u, 'Phone navigation must keep the five primary destinations evenly distributed.');
assert.match(shellStyles, /\.content\s*\{[\s\S]*padding:\s*18px 0 92px/u, 'Phone content must reserve space for the fixed bottom navigation.');
assert.match(shellStyles, /\.mobile-nav\.is-hidden\s*\{[\s\S]*translateY\(calc\(100% \+ 20px\)\)/u, 'Hidden phone navigation must slide below the viewport rather than disappearing abruptly.');
assert.match(shellStyles, /@media\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.topbar[\s\S]*\.mobile-nav/u, 'Mobile header and navigation animation must respect reduced-motion preferences.');

console.log('Minimal dashboard design contract passed.');
