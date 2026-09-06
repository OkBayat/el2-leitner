import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDirectory, '..');
const distRoot = path.join(uiRoot, 'dist', 'browser');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');

function pngDimensions(filePath) {
	const bytes = fs.readFileSync(filePath);
	assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', `${filePath} must be a PNG file.`);
	return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

const pkg = JSON.parse(read('package.json'));
assert.match(pkg.scripts['build:production'], /generate-pwa-worker\.mjs/u, 'Production builds must generate the service worker after Angular emits hashed bundles.');
assert.match(pkg.scripts.test, /build:production.*check:pwa/u, 'The complete test command must validate the generated PWA output.');

const angular = JSON.parse(read('angular.json'));
assert.ok(angular.projects.vocora.architect.build.options.assets.includes('src/manifest.webmanifest'), 'Angular must keep the compatibility web app manifest available at the origin root.');
assert.ok(angular.projects.vocora.architect.build.options.assets.includes('src/vocora-v2.webmanifest'), 'Angular must publish the versioned install manifest at the origin root.');
assert.ok(angular.projects.vocora.architect.build.options.styles.includes('src/pwa.scss'), 'The installed-app safe-area stylesheet must be part of every build.');

const manifest = JSON.parse(read('src/vocora-v2.webmanifest'));
assert.equal(manifest.id, '/', 'The PWA needs a stable app identity.');
assert.equal(manifest.start_url, '/dashboard');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.prefer_related_applications, false);
assert.equal(manifest.name, 'Vocora', 'The install prompt must use the current Vocora product name.');
assert.equal(manifest.short_name, 'Vocora', 'The installed app label must use the current Vocora product name.');
assert.ok(manifest.description, 'Install metadata must include a description.');
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
	assert.match(icon.src, /^\/assets\/icons\/vocora-v\d+-/u, `${icon.src} must use a versioned Vocora icon URL so install caches can be invalidated.`);
	const [expectedWidth, expectedHeight] = icon.sizes.split('x').map(Number);
	const iconPath = path.join(uiRoot, icon.src.replace(/^\//u, ''));
	assert.ok(fs.existsSync(iconPath), `${icon.src} must exist.`);
	assert.deepEqual(pngDimensions(iconPath), {width: expectedWidth, height: expectedHeight}, `${icon.src} must match its declared dimensions.`);
}

const index = read('src/index.html');
const manifestLinkMatch = index.match(/<link rel="manifest" href="([^"]+)">/u);
assert.ok(manifestLinkMatch, 'The document must reference a web app manifest.');
const manifestUrl = manifestLinkMatch[1];
assert.equal(manifestUrl, '/vocora-v2.webmanifest', 'The install manifest URL must be versioned so an older service worker cannot serve stale install metadata.');
assert.match(index, /apple-mobile-web-app-capable" content="yes"/u);
assert.match(index, /apple-mobile-web-app-title" content="Vocora"/u);
assert.match(index, /viewport-fit=cover/u);
assert.match(index, /format-detection" content="telephone=no"/u);
assert.doesNotMatch(index, /safari-pinned-tab\.svg/u, 'The legacy Safari pinned-tab book artwork must not remain referenced.');

const appleTouchMatch = index.match(/<link rel="apple-touch-icon" sizes="180x180" href="([^"]+)">/u);
assert.ok(appleTouchMatch, 'iPhone installation must reference an explicit 180x180 Apple touch icon.');
const appleTouchUrl = appleTouchMatch[1];
assert.match(appleTouchUrl, /^\/assets\/icons\/vocora-v\d+-apple-touch-180\.png$/u, 'The iPhone icon must use a versioned Vocora asset URL.');
assert.deepEqual(
	pngDimensions(path.join(uiRoot, appleTouchUrl.replace(/^\//u, ''))),
	{width: 180, height: 180},
	'The referenced iPhone installation icon must be exactly 180x180.',
);

const appRoot = read('src/app/app.ts');
const installService = read('src/app/core/pwa/pwa-install.service.ts');
const updateService = read('src/app/core/pwa/pwa-update.service.ts');
const installCard = read('src/app/shared/pwa/pwa-install-card.component.ts');
const routes = read('src/app/app.routes.ts');
const authGuard = read('src/app/core/auth/auth.guard.ts');
const settings = read('src/app/features/settings/settings-page.component.ts');
const globalStyles = read('src/styles.scss');
const pwaStyles = read('src/pwa.scss');
const server = read('../back/src/createApp.js');
const dockerfile = read('../back/Dockerfile');

assert.match(appRoot, /PwaInstallService/u, 'The application root must instantiate install-prompt capture during bootstrap.');
assert.match(appRoot, /pwaInstallation\.mode\(\)/u, 'The one-shot Android install prompt listener must be active before Settings is opened.');
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
assert.match(pwaStyles, /app-shell \.mobile-nav[\s\S]*var\(--safe-area-bottom\)/u, 'Mobile app chrome must respect the Home indicator safe area.');
assert.match(pwaStyles, /app-review-page \.review-action-footer[\s\S]*var\(--safe-area-bottom\)/u, 'The fixed review footer must respect the Home indicator safe area.');
const standaloneRootOverflow = /@media\s*\(\s*display-mode\s*:\s*standalone\s*\)\s*\{[\s\S]*?html\s*,\s*body\s*\{[\s\S]*?(?:overflow(?:-[xy])?|overscroll-behavior(?:-[xy])?)\s*:/u;
assert.doesNotMatch(globalStyles, standaloneRootOverflow, 'Standalone mode must not turn the root document into a separate overflow container; the viewport must remain vertically scrollable.');
assert.doesNotMatch(pwaStyles, standaloneRootOverflow, 'PWA-only styles must not lock or replace native viewport scrolling in the installed app.');
assert.match(server, /extension === "\.webmanifest"/u, 'The server must give every versioned manifest deterministic no-store headers.');
assert.match(server, /Service-Worker-Allowed/u, 'The service-worker scope must be explicit.');
assert.match(
	dockerfile,
	/COPY ui\/tools \.\/tools[\s\S]*RUN npm run build:production/u,
	'The Docker production stage must include the service-worker generator before running the UI build.',
);

assert.ok(fs.existsSync(distRoot), 'Production output must exist before PWA validation.');
for (const required of ['index.html', 'vocora-v2.webmanifest', 'service-worker.js']) {
	assert.ok(fs.existsSync(path.join(distRoot, required)), `Production output must contain ${required}.`);
}
const builtManifest = JSON.parse(fs.readFileSync(path.join(distRoot, 'vocora-v2.webmanifest'), 'utf8'));
assert.equal(builtManifest.id, manifest.id, 'The built manifest must match source install identity.');
assert.equal(builtManifest.name, 'Vocora', 'The built install manifest must expose the current product name.');

const worker = fs.readFileSync(path.join(distRoot, 'service-worker.js'), 'utf8');
assert.match(worker, /const CACHE_NAME = CACHE_PREFIX \+ "[0-9a-f]{20}";/u, 'The generated cache must be content-versioned.');
assert.match(worker, /request\.mode === 'navigate'/u, 'Offline navigation must fall back to the cached app shell.');
assert.match(worker, /url\.pathname === '\/service-worker\.js'.*api/u, 'API traffic must be explicitly excluded from the service-worker cache.');
assert.match(worker, /removeOldCaches/u, 'Obsolete app versions must be removed after activation.');
assert.match(worker, /CACHEABLE_PATH\.test\(url\.pathname\)/u, 'Non-shell static assets must be cached on demand instead of blocking service-worker installation.');
assert.match(worker, /response\.status === 200/u, 'Runtime caching must only persist complete successful responses.');

const precacheMatch = worker.match(/const PRECACHE_URLS = Object\.freeze\((\[[\s\S]*?\])\);/u);
assert.ok(precacheMatch, 'The generated worker must expose a deterministic precache list.');
const precache = JSON.parse(precacheMatch[1]);
const requiredOfflineAssets = new Set([
	'/index.html',
	manifestUrl,
	appleTouchUrl,
	...icons.map((icon) => icon.src),
]);
for (const required of requiredOfflineAssets) {
	assert.ok(precache.includes(required), `${required} must be available to the installed app offline.`);
}
assert.equal(precache.some((url) => url.startsWith('/api/')), false, 'Authenticated API responses must never be precached.');

const builtIndex = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
const startupAssets = new Set(
	[...builtIndex.matchAll(/\b(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/giu)]
		.map((match) => path.basename(match[1])),
);
const builtBundles = fs.readdirSync(distRoot).filter((name) => /\.(?:js|css)$/u.test(name) && name !== 'service-worker.js');
const startupBundles = builtBundles.filter((name) => startupAssets.has(name));
assert.ok(startupBundles.length > 0, 'The production index must reference at least one startup bundle.');
for (const bundle of startupBundles) assert.ok(precache.includes(`/${bundle}`), `${bundle} must be precached for offline startup.`);

const lazyBundles = builtBundles.filter((name) => !startupAssets.has(name));
assert.ok(lazyBundles.some((name) => name.startsWith('chunk-')), 'The production build must include lazy chunks for this regression test.');
for (const bundle of lazyBundles) {
	assert.equal(precache.includes(`/${bundle}`), false, `${bundle} must be cached on demand rather than during service-worker installation.`);
}

console.log(`PWA contract passed with ${icons.length} manifest icons and ${precache.length} precached assets.`);
