import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDirectory, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');

const index = read('src/index.html');
const manifest = JSON.parse(read('src/manifest.webmanifest'));
const themeService = read('src/app/core/theme/theme.service.ts');
const pwaStyles = read('src/pwa.scss');

const themeColorTags = index.match(/<meta name="theme-color"[^>]*>/gu) || [];
assert.equal(themeColorTags.length, 1, 'Installed PWA must expose exactly one runtime theme-color source.');
assert.match(themeColorTags[0], /content="#f8f9ff"/u, 'Installed PWA should start with the same light surface as the app shell.');
assert.doesNotMatch(themeColorTags[0], /media=/u, 'Device dark mode must not override an explicit light Vocora theme before Angular synchronizes it.');
assert.match(index, /<meta name="color-scheme" content="light">/u, 'System controls should start in the same light scheme as the initial app surface.');

assert.equal(manifest.theme_color, '#f8f9ff', 'WebAPK theme color must match the light app surface instead of a separate brand/system color.');
assert.equal(manifest.background_color, '#f8f9ff', 'WebAPK launch background must match its system chrome fallback.');
assert.equal(manifest.theme_color, manifest.background_color, 'Installed system chrome and launch surface must not disagree.');

assert.match(themeService, /LIGHT_SYSTEM_CHROME_COLOR = '#f8f9ff'/u, 'Light mode needs one canonical system-bar color.');
assert.match(themeService, /DARK_SYSTEM_CHROME_COLOR = '#111318'/u, 'Dark mode needs one canonical system-bar color.');
assert.match(themeService, /updateMeta\('theme-color', chromeColor\)/u, 'Changing Vocora theme must update the browser/PWA system chrome color.');
assert.match(themeService, /updateMeta\('color-scheme', resolved\)/u, 'Changing Vocora theme must also update the native control color scheme.');
assert.match(themeService, /activeMode !== 'system'/u, 'OS theme changes must only drive system chrome while Vocora follows the system theme.');

assert.match(
	pwaStyles,
	/@media\(display-mode: standalone\)[\s\S]*html, body\s*\{[\s\S]*background:\s*var\(--vocora-system-chrome-color, var\(--mat-sys-surface\)\)/u,
	'Edge-to-edge Android system bars must have the active app surface painted behind them.',
);
assert.doesNotMatch(
	pwaStyles,
	/@media\(display-mode: standalone\)[\s\S]*html, body\s*\{[\s\S]*?(?:overflow|overscroll-behavior)\s*:/u,
	'System-bar theming must not reintroduce the standalone scrolling bug.',
);

console.log('PWA system bar color contract passed.');
