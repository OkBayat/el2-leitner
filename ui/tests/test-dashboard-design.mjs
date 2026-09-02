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
const chartTs = read('src/app/shared/charts/learning-chart.component.ts');
const reportsTs = read('src/app/features/reports/reports-page.component.ts');
const packageJson = read('package.json');
const globalStyles = read('src/styles.scss');
const leitnerPalette = read('src/styles/_leitner-google-palette.scss');

assert.match(dashboardTs, /templateUrl:\s*'dashboard-page\.component\.html'/u, 'Dashboard markup should have one dedicated template owner.');
assert.match(dashboardTs, /styleUrl:\s*'dashboard-page\.component\.scss'/u, 'Dashboard layout should have one dedicated style owner.');
assert.match(dashboardTs, /houseWidths = \[40, 54, 70, 85, 100\] as const/u, 'Leitner house widths must preserve the approved pyramid progression.');
assert.match(dashboardHtml, /\[style\.width\.%\]="houseWidths\[house\.box - 1\]"/u, 'Every Leitner row must derive its visual width from the pyramid contract.');
assert.match(dashboardHtml, /data-testid="house-status"/u, 'House status needs its stable regression locator.');
assert.match(dashboardHtml, />Today's plan</u, 'The current dashboard E2E contract must keep the Today plan label.');
assert.match(dashboardHtml, /Today's progress/u, 'The minimal dashboard must expose the compact daily progress summary.');
assert.equal(dashboardHtml.match(/class="leitner-row"/gu)?.length, 1, 'One template loop must own all five Leitner rows.');
assert.doesNotMatch(dashboardHtml, /data-tooltip|\[attr\.title\]/u, 'Leitner state cells must not expose hover tooltip attributes.');
assert.doesNotMatch(dashboardTs, /segmentTooltip/u, 'Dashboard TypeScript must not retain obsolete tooltip-building logic.');
assert.doesNotMatch(dashboardStyles, /leitner-segment::after|leitner-segment:hover::after|attr\(data-tooltip\)/u, 'Leitner tooltip pseudo-elements must be removed from the stylesheet.');

assert.match(packageJson, /"chart\.js":\s*"4\.5\.1"/u, 'Chart.js must be the single charting dependency.');
assert.match(chartTs, /from 'chart\.js'/u, 'The shared learning chart must use Chart.js directly.');
assert.match(chartTs, /LearningChartType = 'bar' \| 'line' \| 'doughnut'/u, 'One shared adapter must support bar, line, and doughnut charts.');
assert.match(chartTs, /Chart\.register\(/u, 'Chart.js controllers and elements must be explicitly registered for tree shaking.');
assert.match(chartTs, /--vocora-chart-primary:rgb\(26 115 232\)/u, 'Charts must use the approved visible blue accent instead of unresolved Material colors.');
assert.match(chartTs, /--vocora-chart-track:rgb\(218 220 224\)/u, 'Doughnut charts must keep a visible neutral track for the unfilled portion.');
assert.match(chartTs, /primary:\s*token\('--vocora-chart-primary'/u, 'Chart rendering must read the stable chart accent token.');
assert.match(chartTs, /track:\s*token\('--vocora-chart-track'/u, 'Doughnut rendering must read the stable track token.');
assert.match(dashboardHtml, /data-testid="leitner-coverage-stat"/u, 'The Leitner coverage summary needs a stable regression locator.');
assert.match(dashboardHtml, /type="doughnut"/u, 'Words in Leitner must render as a doughnut chart rather than a bare number.');
assert.match(dashboardHtml, /leitnerCoverage\(\)\.entered\.toLocaleString/u, 'The coverage card must show entered versus total word counts.');
assert.match(dashboardTs, /readonly leitnerCoverage = computed/u, 'Leitner coverage must be derived from learning state.');
assert.match(dashboardTs, /word\.introducedOn \|\| word\.box > 0 \|\| word\.masteredAt/u, 'Coverage must include words that have ever entered Leitner, including mastered/legacy active words.');
assert.match(dashboardHtml, /type="bar"/u, 'Dashboard activity must use the same chart adapter for bar charts.');
assert.match(reportsTs, /type="line"/u, 'Reports must use the same chart adapter for line charts.');
assert.doesNotMatch(dashboardTs, /\{label: 'Words in Leitner', value:/u, 'Words in Leitner must not fall back to the old bare-number stat card.');

assert.match(shellTs, /MatMenuModule/u, 'The compact hamburger/account navigation should use Angular Material menus.');
assert.match(shellHtml, /class="topbar"/u, 'The application shell must use the minimal top bar.');
assert.match(shellHtml, /class="product-tabs"/u, 'Primary destinations must remain visible as compact top tabs on larger screens.');
assert.doesNotMatch(shellStyles, /\.topbar\s*\{[^}]*border-bottom/u, 'The top header must not render a bottom separator.');
assert.doesNotMatch(shellStyles, /\.product-tabs\s*\{[^}]*border-bottom/u, 'The desktop navigation strip must not render a bottom separator.');
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

assert.match(globalStyles, /@use '.\/styles\/leitner-google-palette' as leitner-google-palette/u, 'The deliberate Leitner palette must have one global style owner.');
assert.match(globalStyles, /@include leitner-google-palette\.apply\(\)/u, 'The Leitner palette must be applied through the global theme composition root.');
for (const color of ['rgb(66 133 244)', 'rgb(52 168 83)', 'rgb(251 188 4)', 'rgb(234 67 53)']) {
	assert.ok(leitnerPalette.includes(color), `Leitner palette must keep the approved storage-inspired color ${color}.`);
}
for (const house of ['2', '3', '4', '5']) {
	assert.match(leitnerPalette, new RegExp(`data-house='${house}'`, 'u'), `House ${house} needs an explicit palette mapping.`);
}
assert.match(leitnerPalette, /background:\s*color-mix\(in srgb, var\(--house-tone\) 16%, var\(--mat-sys-surface\)\)/u, 'Occupied states should use a light airy tint rather than a saturated block.');
assert.match(leitnerPalette, /background:\s*color-mix\(in srgb, var\(--house-tone\) 6%, var\(--mat-sys-surface\)\)/u, 'Empty states should remain visually quiet.');
assert.match(leitnerPalette, /\.leitner-house-name::before/u, 'Each house label should have a small restrained color cue.');
assert.match(dashboardStyles, /\.leitner-row\s*\{[^}]*border-bottom:\s*1px solid var\(--mat-sys-outline-variant\)/u, 'Leitner rows themselves must keep the original one-pixel separator.');
assert.doesNotMatch(leitnerPalette, /\.leitner-row\s*\{[^}]*border-bottom:\s*2px/u, 'The stronger border must not be applied to whole Leitner rows.');
assert.match(leitnerPalette, /\.leitner-row \.leitner-segment\s*\{[^}]*border:\s*0;[^}]*border-bottom:\s*2px solid color-mix\(in srgb, var\(--house-tone\) 32%, var\(--mat-sys-outline-variant\)\)/u, 'Occupied Leitner state cells must keep their original house-colored border, changed only to a two-pixel bottom edge.');
assert.match(leitnerPalette, /\.leitner-segment:not\(\.is-occupied\)\s*\{[^}]*border-bottom-color:\s*color-mix\(in srgb, var\(--house-tone\) 16%, var\(--mat-sys-outline-variant\)\)/u, 'Empty cells must keep their quieter original house-colored border tone.');
assert.match(leitnerPalette, /\.leitner-segment\.is-occupied:hover\s*\{[^}]*border-bottom-color:\s*color-mix\(in srgb, var\(--house-tone\) 50%, var\(--mat-sys-outline-variant\)\)/u, 'Hovered occupied cells must keep the original stronger house-colored border tone.');
assert.doesNotMatch(leitnerPalette, /linear-gradient|radial-gradient/u, 'The storage-inspired palette must remain flat and simple.');

assert.match(dashboardStyles, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/u, 'Desktop summary metrics must remain a compact four-column strip.');
assert.match(dashboardStyles, /\.leitner-coverage-content\s*\{[\s\S]*display:\s*flex/u, 'Coverage chart and counts should fit inside the existing compact stat card.');
assert.match(dashboardStyles, /@media\(max-width:\s*640px\)/u, 'Dashboard must keep an explicit phone layout.');
assert.match(shellStyles, /overflow-x:\s*auto/u, 'Desktop/tablet top navigation must remain usable when space is constrained.');
assert.match(shellStyles, /@media\(max-width:\s*640px\)[\s\S]*\.product-tabs\s*\{[\s\S]*display:\s*none/u, 'Top navigation must be hidden on phones.');
assert.match(shellStyles, /\.topbar\.is-hidden\s*\{[\s\S]*translateY\(calc\(-100% - 1px\)\)/u, 'Hidden phone header must slide above the viewport instead of disappearing abruptly.');
assert.match(shellStyles, /\.mobile-nav\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*8px/u, 'Phone navigation must stay fixed at the bottom like the base branch.');
assert.match(shellStyles, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/u, 'Phone navigation must keep the five primary destinations evenly distributed.');
assert.match(shellStyles, /\.content\s*\{[\s\S]*padding:\s*18px 0 92px/u, 'Phone content must reserve space for the fixed bottom navigation.');
assert.match(shellStyles, /\.mobile-nav\.is-hidden\s*\{[\s\S]*translateY\(calc\(100% \+ 20px\)\)/u, 'Hidden phone navigation must slide below the viewport rather than disappearing abruptly.');
assert.match(shellStyles, /@media\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.topbar[\s\S]*\.mobile-nav/u, 'Mobile header and navigation animation must respect reduced-motion preferences.');

console.log('Chart.js Leitner coverage design contract passed.');
