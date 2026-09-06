import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDirectory, '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const INSTALL_BRAND_COLOR = '#48BF68';
const DEFAULT_RUNTIME_CHROME_COLOR = '#f8f9ff';

const index = read('src/index.html');
const compatibilityManifest = JSON.parse(read('src/manifest.webmanifest'));
const installManifest = JSON.parse(read('src/vocora-v3.webmanifest'));
const themeService = read('src/app/core/theme/theme.service.ts');
const pwaStyles = read('src/pwa.scss');

const themeColorTags = index.match(/<meta name="theme-color"[^>]*>/gu) || [];
assert.equal(themeColorTags.length, 1, 'Installed PWA must expose exactly one initial theme-color source.');
assert.match(themeColorTags[0], /content="#f8f9ff"/u, 'Runtime system chrome must start from the light app surface rather than remaining pinned to the install brand color.');
assert.doesNotMatch(themeColorTags[0], /media=/u, 'Device dark mode must not override an explicit Vocora theme before Angular synchronizes saved settings.');
assert.match(index, /<meta name="color-scheme" content="light">/u, 'System controls should start in the same light scheme as the initial app surface.');
assert.match(index, /<meta name="msapplication-TileColor" content="#48BF68">/u, 'Windows tile fallback must keep the Vocora brand color.');
assert.match(index, /<link rel="manifest" href="\/vocora-v3\.webmanifest">/u, 'System-chrome metadata changes must use a fresh install-manifest URL so older WebAPK metadata is not reused.');

for (const manifest of [compatibilityManifest, installManifest]) {
	assert.equal(manifest.background_color, INSTALL_BRAND_COLOR, 'Install splash background must keep the Vocora brand color.');
	assert.equal(manifest.theme_color, DEFAULT_RUNTIME_CHROME_COLOR, 'Installed system chrome fallback must match the default app surface, not the splash color.');
	assert.notEqual(manifest.theme_color, manifest.background_color, 'Splash branding and runtime system chrome must remain separate concerns.');
}

assert.match(themeService, /LIGHT_SYSTEM_CHROME_COLOR = '#f8f9ff'/u, 'Light mode should use the active light app surface for system chrome.');
assert.match(themeService, /DARK_SYSTEM_CHROME_COLOR = '#111318'/u, 'Dark mode should use the active dark app surface for system chrome.');
assert.match(themeService, /updateMeta\('theme-color', chromeColor\)/u, 'Changing Vocora theme must update the browser/PWA status-bar color.');
assert.match(themeService, /updateMeta\('color-scheme', resolved\)/u, 'Changing Vocora theme must update the native control and navigation-bar color scheme.');
assert.match(themeService, /root\.style\.backgroundColor = chromeColor/u, 'The root surface behind transparent Android system bars must follow the app theme.');
assert.match(themeService, /body\.style\.backgroundColor = chromeColor/u, 'The body surface behind transparent Android navigation chrome must follow the app theme.');
assert.match(themeService, /body\.style\.colorScheme = resolved/u, 'The body must explicitly opt into the app-selected color scheme instead of the phone theme.');
assert.match(themeService, /activeMode !== 'system'/u, 'OS theme changes must only drive system chrome while Vocora follows the system theme.');

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
