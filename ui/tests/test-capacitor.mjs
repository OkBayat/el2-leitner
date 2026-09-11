import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const config = readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
const angular = JSON.parse(readFileSync(new URL('../angular.json', import.meta.url), 'utf8'));
const nativeEnvironment = readFileSync(new URL('../src/environments/environment.native.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const generatedVersion = readFileSync(new URL('../src/generated/app-version.ts', import.meta.url), 'utf8');
const appTemplate = readFileSync(new URL('../src/app/app.html', import.meta.url), 'utf8');
const updateStatusTemplate = readFileSync(new URL('../src/app/shared/pwa/pwa-status.component.html', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../src/styles.scss', import.meta.url), 'utf8');
const mobileWorkflow = readFileSync(new URL('../../.github/workflows/mobile-release.yml', import.meta.url), 'utf8');
const mobileDocumentation = readFileSync(new URL('../../docs/mobile/CAPACITOR.md', import.meta.url), 'utf8');
const scripts = packageJson.scripts;
const androidManifestUrl = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url);
const androidBuildUrl = new URL('../android/build.gradle', import.meta.url);
const androidVariablesUrl = new URL('../android/variables.gradle', import.meta.url);
const iosInfoUrl = new URL('../ios/App/App/Info.plist', import.meta.url);

assert.match(config, /appId:\s*'ir\.vocora'/u);
assert.match(config, /webDir:\s*'dist\/browser'/u);
assert.doesNotMatch(config, /server:\s*\{[^}]*url:/su, 'Production Capacitor config must not load a remote site.');
assert.match(config, /cleartext:\s*false/u);
assert.match(config, /autoUpdate:\s*liveUpdatesEnabled\s*\?\s*'onlyDownload'\s*:\s*'off'/u);
assert.match(config, /requestedChannel\s*===\s*'production'\s*\?\s*undefined\s*:\s*requestedChannel/u);
assert.equal(angular.projects.vocora.architect.build.configurations.native.fileReplacements[0].with, 'src/environments/environment.native.ts');
assert.match(nativeEnvironment, /apiBaseUrl:\s*'https:\/\/vocora\.ir'/u);
assert.doesNotMatch(nativeEnvironment, /localhost|127\.0\.0\.1/u);
assert.match(generatedVersion, new RegExp(`WEB_APP_VERSION = '${packageJson.version.replaceAll('.', '\\.')}';`, 'u'));
assert.equal(scripts['mobile:sync'], 'npm run mobile:build && cap sync');
assert.match(appTemplate, /\[attr\.inert\]="appUpdates\.binaryUpdate\(\) === 'required'/u);
assert.match(updateStatusTemplate, /role="alertdialog"/u);
assert.match(updateStatusTemplate, /data-testid="native-required-update-screen"/u);
assert.match(globalStyles, /\.cdk-overlay-container\.vocora-required-update-blocked[\s\S]*visibility:\s*hidden/u);
assert.match(mobileDocumentation, /allow_device_self_set/u);
assert.match(mobileDocumentation, /--state default --prod --device --no-dev --no-emulator --no-self-assign/u);
assert.match(mobileWorkflow, /Release tag \$GITHUB_REF_NAME must match ui\/package\.json version/u);
assert.match(mobileWorkflow, /gh release create "\$TAG" --target "\$GITHUB_SHA"/u);
const webPackageIndex = mobileWorkflow.indexOf('Package deployable web bundle');
const nativeBuildIndex = mobileWorkflow.indexOf('Test native contracts and synchronize native projects');
assert.ok(webPackageIndex > 0 && nativeBuildIndex > webPackageIndex, 'The PWA artifact must be packaged before the native build overwrites dist/browser.');

for (const directory of ['../android', '../ios']) {
  if (process.env['VOCORA_REQUIRE_NATIVE_PROJECTS'] === 'true') {
    assert.equal(existsSync(new URL(directory, import.meta.url)), true, `${directory} must exist.`);
  }
}

if (existsSync(androidManifestUrl) && existsSync(androidBuildUrl) && existsSync(androidVariablesUrl) && existsSync(iosInfoUrl)) {
  const androidManifest = readFileSync(androidManifestUrl, 'utf8');
  const androidBuild = readFileSync(androidBuildUrl, 'utf8');
  const androidVariables = readFileSync(androidVariablesUrl, 'utf8');
  const iosInfo = readFileSync(iosInfoUrl, 'utf8');
  assert.match(androidManifest, /android:usesCleartextTraffic="false"/u);
  assert.match(androidManifest, /android:scheme="vocora"/u);
  assert.deepEqual([...androidManifest.matchAll(/<uses-permission\b/gu)].length, 1, 'Android should request only INTERNET.');
  assert.match(androidVariables, /buildToolsVersion\s*=\s*'36\.0\.0'/u);
  assert.match(androidBuild, /plugins\.withId\('com\.android\.library'\)/u);
  assert.doesNotMatch(androidBuild, /google-services/u, 'Unused Google Services build plugins must not be bundled.');
  assert.match(iosInfo, /<string>vocora<\/string>/u);
  assert.match(iosInfo, /<key>WKAppBoundDomains<\/key>[\s\S]*?<string>vocora\.ir<\/string>/u);
}

console.info('Capacitor production contract checks passed.');
