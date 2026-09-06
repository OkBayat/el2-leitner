import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDirectory, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const INSTALL_BRAND_COLOR = '#48BF68';

const index = read('src/index.html');
const manifest = JSON.parse(read('src/manifest.webmanifest'));
const themeService = read('src/app/core/theme/theme.service.ts');
const pwaStyles = read('src/pwa.scss');

const themeColorTags = index.match(/<meta name="theme-color"[^>]*>/gu) || [];
assert.equal(themeColorTags.length, 1, 'Installed PWA must expose exactly one initial theme-color source.');
assert.match(themeColorTags[0], /content="#48BF68"/u, 'PWA boot chrome should start with the Vocora brand color before Angular synchronizes the active app theme.');
assert.doesNotMatch(themeColorTags[0], /media=/u, 'Device dark mode must not override the deterministic install/boot brand color before Angular synchronizes it.');
assert.match(index, /<meta name="color-scheme" content="light">/u, 'System controls should start in the same light scheme as the initial app surface.');
assert.match(index, /<meta name="msapplication-TileColor" content="#48BF68">/u, 'Windows tile fallback must use the Vocora brand color.');

assert.equal(manifest.theme_color, INSTALL_BRAND_COLOR, 'WebAPK install chrome must use the Vocora brand color.');
assert.equal(manifest.background_color, INSTALL_BRAND_COLOR, 'WebAPK launch background must use the Vocora brand color.');
assert.equal(manifest.theme_color, manifest.background_color, 'Installed launch chrome and launch background must use the same brand color.');

assert.match(themeService, /LIGHT_SYSTEM_CHROME_COLOR = '#f8f9ff'/u, 'After Angular boots, light mode should return system chrome to the active light app surface.');
assert.match(themeService, /DARK_SYSTEM_CHROME_COLOR = '#111318'/u, 'After Angular boots, dark mode should use the active dark app surface.');
assert.match(themeService, /updateMeta\('theme-color', chromeColor\)/u, 'Changing Vocora theme must update the browser/PWA system chrome color after startup.');
assert.match(themeService, /updateMeta\('color-scheme', resolved\)/u, 'Changing Vocora theme must also update the native control color scheme.');
assert.match(themeService, /activeMode !== 'system'/u, 'OS theme changes must only drive system chrome while Vocora follows the system theme.');

assert.match(
	pwaStyles,
	/@media\(display-mode: standalone\)[\s\S]*html, body\s*\{[\s\S]*background:\s*var\(--vocora-system-chrome-color, var\(--mat-sys-surface\)\)/u,
	'Edge-to-edge Android system bars must have the active app surface painted behind them after startup.',
);
assert.doesNotMatch(
	pwaStyles,
	/@media\(display-mode: standalone\)[\s\S]*html, body\s*\{[\s\S]*?(?:overflow|overscroll-behavior)\s*:/u,
	'System-bar theming must not reintroduce the standalone scrolling bug.',
);

console.log('PWA install and runtime system bar color contract passed.');
