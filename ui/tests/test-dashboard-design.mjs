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

// The requested sidebar/dock replaces the obsolete top-tab and scroll-hide contracts.
assert.doesNotMatch(shellHtml, /class="(?:topbar|product-tabs)"/u, 'The old desktop navbar and horizontal tabs must be removed.');
assert.match(shellHtml, /class="desktop-sidebar"/u, 'Desktop navigation must use the requested persistent left sidebar.');
assert.match(shellHtml, /class="mobile-status"/u, 'Phones must keep the compact status row shown in the mobile reference.');
assert.match(shellHtml, /class="mobile-nav"/u, 'Phones must use the fixed bottom navigation.');
assert.doesNotMatch(shellTs, /mobileNavHidden|window:scroll/u, 'Navigation must remain visible rather than hiding on scroll.');

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

console.log('Chart.js Leitner coverage design contract passed.');
