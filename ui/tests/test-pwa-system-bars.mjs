import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDirectory, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const INSTALL_BRAND_COLOR = '#48BF68';
const LIGHT_PAGE_COLOR = '#ffffff';
const DARK_PAGE_COLOR = '#0f1611';
const THEME_MODE_STORAGE_KEY = 'vocora-theme-mode-v1';

const index = read('src/index.html');
const compatibilityManifest = JSON.parse(read('src/manifest.webmanifest'));
const installManifest = JSON.parse(read('src/vocora-v4.webmanifest'));
const themeService = read('src/app/core/theme/theme.service.ts');
const themeBootstrap = read('src/theme-bootstrap.js');
const pwaStyles = read('src/pwa.scss');
const designSystem = read('src/styles/_vocora-design-system.scss');

function runThemeBootstrap(savedMode, prefersDark = false) {
	const properties = new Map();
	const root = {
		dataset: {},
		style: {
			colorScheme: '',
			backgroundColor: '',
			setProperty: (name, value) => properties.set(name, value),
		},
	};
	const themeColors = [
		{content: LIGHT_PAGE_COLOR, dataset: {vocoraTheme: 'light'}, media: '(prefers-color-scheme: light)'},
		{content: DARK_PAGE_COLOR, dataset: {vocoraTheme: 'dark'}, media: '(prefers-color-scheme: dark)'},
	];
	const colorScheme = {content: 'light dark'};
	vm.runInNewContext(themeBootstrap, {
		document: {
			documentElement: root,
			querySelector: (selector) => selector.includes('color-scheme') ? colorScheme : null,
			querySelectorAll: (selector) => selector.includes('theme-color') ? themeColors : [],
		},
		localStorage: {getItem: (key) => key === THEME_MODE_STORAGE_KEY ? savedMode : null},
		matchMedia: () => ({matches: prefersDark}),
	});
	return {root, themeColors, colorScheme, properties};
}

const themeColorTags = index.match(/<meta name="theme-color"[^>]*>/gu) || [];
assert.equal(themeColorTags.length, 2, 'Installed PWA must expose separate light and dark system-chrome colors to Android WebAPK metadata.');
assert.match(themeColorTags[0], /content="#ffffff"/u, 'Light system chrome must exactly match the light page surface.');
assert.match(themeColorTags[0], /media="\(prefers-color-scheme: light\)"/u, 'Light system chrome must follow the device light preference before Angular starts.');
assert.match(themeColorTags[1], /content="#0f1611"/u, 'Dark system chrome must exactly match the dark page surface.');
assert.match(themeColorTags[1], /media="\(prefers-color-scheme: dark\)"/u, 'Dark system chrome must follow the device dark preference before Angular starts.');
assert.match(index, /<meta name="color-scheme" content="light dark">/u, 'The browser must know both supported schemes before CSS loads.');
assert.match(index, /<meta name="msapplication-TileColor" content="#48BF68">/u, 'Windows tile fallback must keep the Vocora brand color.');
assert.match(index, /<script src="\/theme-bootstrap\.js"><\/script>/u, 'Saved theme restoration must run synchronously from a CSP-compatible same-origin script.');
assert.ok(index.indexOf('/theme-bootstrap.js') < index.indexOf('</head>'), 'Saved theme restoration must run inside the document head before first paint.');
assert.match(index, /<link rel="manifest" href="\/vocora-v4\.webmanifest">/u, 'System-chrome metadata changes must use a fresh install-manifest URL so older WebAPK metadata is not reused.');

for (const manifest of [compatibilityManifest, installManifest]) {
	assert.equal(manifest.background_color, INSTALL_BRAND_COLOR, 'Install splash background must keep the Vocora brand color.');
	assert.equal(manifest.theme_color, LIGHT_PAGE_COLOR, 'Installed system chrome fallback must exactly match the default app surface, not the splash color.');
	assert.notEqual(manifest.theme_color, manifest.background_color, 'Splash branding and runtime system chrome must remain separate concerns.');
}

assert.match(designSystem, /--color-paper-white:\s*#ffffff/u, 'The pre-paint light fallback must match the Layer A light page color.');
assert.match(designSystem, /--color-dark-page:\s*#0f1611/u, 'The pre-paint dark fallback must match the Layer A dark page color.');
assert.doesNotMatch(themeService, /#[0-9a-f]{3,8}\b/iu, 'Runtime theme ownership must not duplicate raw page colors.');
assert.match(themeService, /THEME_MODE_STORAGE_KEY = 'vocora-theme-mode-v1'/u, 'Runtime theme changes must share one cache key with first-paint restoration.');
assert.match(themeService, /localStorage\?\.setItem\(THEME_MODE_STORAGE_KEY, mode\)/u, 'Every accepted theme change must cache the mode for the next first paint.');
assert.match(themeService, /SYSTEM_THEME_MEDIA/u, 'Runtime theme selection must preserve the device-aware WebAPK metadata contract.');
assert.doesNotMatch(themeService, /updateMeta\('theme-color'/u, 'Runtime updates must not collapse device-aware theme-color tags into one static color.');
assert.match(themeService, /updateMeta\('color-scheme', resolved\)/u, 'Changing Vocora theme must update the native control and navigation-bar color scheme.');
assert.match(themeService, /getPropertyValue\('--vocora-surface-page'\)/u, 'Runtime system chrome must derive from the canonical page-surface token.');
assert.match(themeService, /root\.style\.removeProperty\('background-color'\)/u, 'Angular runtime ownership must release the pre-paint root background override.');
assert.match(themeService, /body\.style\.removeProperty\('background-color'\)/u, 'Angular runtime ownership must leave the body background to canonical CSS.');
assert.match(themeService, /body\.style\.colorScheme = resolved/u, 'The body must explicitly opt into the app-selected color scheme instead of the phone theme.');
assert.match(themeService, /activeMode !== 'system'/u, 'OS theme changes must only drive system chrome while Vocora follows the system theme.');

const restoredDark = runThemeBootstrap('dark');
assert.equal(restoredDark.root.dataset.theme, 'dark', 'A saved dark preference must be restored before Angular starts.');
assert.equal(restoredDark.root.style.colorScheme, 'dark');
assert.equal(restoredDark.root.style.backgroundColor, DARK_PAGE_COLOR);
assert.equal(restoredDark.properties.get('--vocora-system-chrome-color'), DARK_PAGE_COLOR);
assert.equal(restoredDark.themeColors[0].media, 'not all');
assert.equal(restoredDark.themeColors[1].media, 'all');
assert.equal(restoredDark.colorScheme.content, 'dark');

const restoredSystemDark = runThemeBootstrap('system', true);
assert.equal(restoredSystemDark.root.dataset.theme, 'dark', 'A saved system preference must resolve from the device before first paint.');
assert.equal(restoredSystemDark.themeColors[0].media, '(prefers-color-scheme: light)');
assert.equal(restoredSystemDark.themeColors[1].media, '(prefers-color-scheme: dark)');

const invalidPreference = runThemeBootstrap('sepia', true);
assert.equal(invalidPreference.root.dataset.theme, 'dark', 'A missing or unknown cache must follow the device before the account setting loads.');
assert.equal(invalidPreference.colorScheme.content, 'dark');

assert.match(
	pwaStyles,
	/@media\(display-mode: standalone\)[\s\S]*html, body\s*\{[\s\S]*background-color:\s*var\(--vocora-system-chrome-color, var\(--mat-sys-surface\)\)/u,
	'Edge-to-edge Android system bars must have the active app surface painted behind them.',
);
assert.doesNotMatch(
	pwaStyles,
	/@media\(display-mode: standalone\)[\s\S]*html, body\s*\{[\s\S]*?(?:overflow|overscroll-behavior)\s*:/u,
	'System-bar theming must not reintroduce the standalone scrolling bug.',
);

console.log('PWA install and runtime system bar color contract passed.');
