import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDirectory, '..');
const distRoot = path.join(uiRoot, 'dist', 'browser');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(uiRoot, relative));

function pngDimensions(filePath) {
	const bytes = fs.readFileSync(filePath);
	assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', `${filePath} must be a PNG file.`);
	return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

const pkg = JSON.parse(read('package.json'));
assert.match(pkg.scripts['build:production'], /generate-pwa-worker\.mjs/u, 'Production builds must generate the service worker after Angular emits hashed bundles.');
assert.match(pkg.scripts.test, /build:production.*check:pwa/u, 'The complete test command must validate the generated PWA output.');

const angular = JSON.parse(read('angular.json'));
assert.ok(angular.projects.vocora.architect.build.options.assets.includes('src/manifest.webmanifest'), 'Angular must publish the web app manifest at the origin root.');

const manifest = JSON.parse(read('src/manifest.webmanifest'));
assert.equal(manifest.id, '/', 'The PWA needs a stable app identity.');
assert.equal(manifest.start_url, '/dashboard');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.prefer_related_applications, false);
assert.ok(manifest.name && manifest.short_name && manifest.description, 'Install metadata must include a name, short name, and description.');
assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/iu);
assert.match(manifest.background_color, /^#[0-9a-f]{6}$/iu);
assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2, 'Installed app shortcuts must expose Review and Words.');

const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
for (const size of ['192x192', '512x512']) {
	assert.ok(icons.some((icon) => icon.sizes === size && String(icon.purpose).includes('any')), `Manifest needs a ${size} regular icon.`);
	assert.ok(icons.some((icon) => icon.sizes === size && String(icon.purpose).includes('maskable')), `Manifest needs a ${size} maskable icon.`);
}
for (const icon of icons) {
	assert.equal(icon.type, 'image/png', `${icon.src} must declare image/png.`);
	const [expectedWidth, expectedHeight] = icon.sizes.split('x').map(Number);
	const iconPath = path.join(uiRoot, icon.src.replace(/^\//u, ''));
	assert.ok(fs.existsSync(iconPath), `${icon.src} must exist.`);
	assert.deepEqual(pngDimensions(iconPath), {width: expectedWidth, height: expectedHeight}, `${icon.src} must match its declared dimensions.`);
}
assert.deepEqual(pngDimensions(path.join(uiRoot, 'assets/icons/apple-touch-icon-180.png')), {width: 180, height: 180});
assert.ok(exists('assets/icons/safari-pinned-tab.svg'), 'Safari pinned-tab artwork must exist.');

const index = read('src/index.html');
assert.match(index, /<link rel="manifest" href="\/manifest\.webmanifest">/u);
assert.match(index, /apple-mobile-web-app-capable" content="yes"/u);
assert.match(index, /apple-mobile-web-app-title" content="Vocora"/u);
assert.match(index, /apple-touch-icon" sizes="180x180"/u);
assert.match(index, /viewport-fit=cover/u);
assert.match(index, /format-detection" content="telephone=no"/u);

const appRoot = read('src/app/app.ts');
const installService = read('src/app/core/pwa/pwa-install.service.ts');
const updateService = read('src/app/core/pwa/pwa-update.service.ts');
const installCard = read('src/app/shared/pwa/pwa-install-card.component.ts');
const routes = read('src/app/app.routes.ts');
const authGuard = read('src/app/core/auth/auth.guard.ts');
const settings = read('src/app/features/settings/settings-page.component.ts');
const shellStyles = read('src/app/shared/app-shell/app-shell.component.scss');
const reviewStyles = read('src/app/features/review/review-page.component.scss');
const globalStyles = read('src/styles.scss');
const server = read('../back/src/createApp.js');

assert.match(appRoot, /PwaUpdateService/u, 'The application root must start the service-worker update lifecycle.');
assert.match(appRoot, /<app-pwa-status/u, 'Connectivity and update status must have one global owner.');
assert.match(installService, /beforeinstallprompt/u, 'Chromium install prompts must be captured for an explicit user action.');
assert.match(installService, /appinstalled/u, 'Successful browser installation must update app state.');
assert.match(updateService, /register\('\/service-worker\.js'/u, 'Production must register the generated root service worker.');
assert.match(updateService, /updateViaCache:\s*'none'/u, 'Service-worker update checks must bypass stale HTTP cache entries.');
assert.match(updateService, /SKIP_WAITING/u, 'Waiting versions must only activate after the user chooses Reload.');
assert.match(installCard, /Add to Home Screen/u, 'iPhone installation instructions must be present.');
assert.match(installCard, /Open as Web App/u, 'Current iOS web-app installation wording must be present.');
assert.match(settings, /<app-pwa-install-card/u, 'Installation controls must live contextually in Settings.');
assert.match(routes, /path:\s*'offline'/u, 'A cold offline launch must have an unguarded route.');
assert.match(authGuard, /error instanceof ApiError && error\.status === 0/u, 'Network failures during authentication must route to the offline fallback.');
assert.match(globalStyles, /--safe-area-bottom:\s*env\(safe-area-inset-bottom/u, 'Global safe-area tokens must support installed iPhones.');
assert.match(shellStyles, /var\(--safe-area-bottom\)/u, 'Mobile app chrome must respect the Home indicator safe area.');
assert.match(reviewStyles, /var\(--safe-area-bottom\)/u, 'The fixed review footer must respect the Home indicator safe area.');
assert.match(server, /manifest\.webmanifest/u, 'The server must give the manifest deterministic headers.');
assert.match(server, /Service-Worker-Allowed/u, 'The service-worker scope must be explicit.');

assert.ok(fs.existsSync(distRoot), 'Production output must exist before PWA validation.');
for (const required of ['index.html', 'manifest.webmanifest', 'service-worker.js']) {
	assert.ok(fs.existsSync(path.join(distRoot, required)), `Production output must contain ${required}.`);
}
const builtManifest = JSON.parse(fs.readFileSync(path.join(distRoot, 'manifest.webmanifest'), 'utf8'));
assert.equal(builtManifest.id, manifest.id, 'The built manifest must match source install identity.');

const worker = fs.readFileSync(path.join(distRoot, 'service-worker.js'), 'utf8');
assert.match(worker, /const CACHE_NAME = CACHE_PREFIX \+ "[0-9a-f]{20}";/u, 'The generated cache must be content-versioned.');
assert.match(worker, /request\.mode === 'navigate'/u, 'Offline navigation must fall back to the cached app shell.');
assert.match(worker, /\^\\\/api\(\?:\\\/\|\$\)/u, 'API traffic must be explicitly excluded from the service-worker cache.');
assert.match(worker, /removeOldCaches/u, 'Obsolete app versions must be removed after activation.');

const precacheMatch = worker.match(/const PRECACHE_URLS = Object\.freeze\((\[[\s\S]*?\])\);/u);
assert.ok(precacheMatch, 'The generated worker must expose a deterministic precache list.');
const precache = JSON.parse(precacheMatch[1]);
for (const required of ['/index.html', '/manifest.webmanifest', '/assets/icons/icon-192.png', '/assets/icons/icon-maskable-512.png']) {
	assert.ok(precache.includes(required), `${required} must be available to the installed app offline.`);
}
assert.equal(precache.some((url) => url.startsWith('/api/')), false, 'Authenticated API responses must never be precached.');

const builtBundles = fs.readdirSync(distRoot).filter((name) => /\.(?:js|css)$/u.test(name) && name !== 'service-worker.js');
for (const bundle of builtBundles) assert.ok(precache.includes(`/${bundle}`), `${bundle} must be precached for offline startup.`);

console.log(`PWA contract passed with ${icons.length} manifest icons and ${precache.length} precached assets.`);
