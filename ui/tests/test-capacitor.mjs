import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const config = readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
const angular = JSON.parse(readFileSync(new URL('../angular.json', import.meta.url), 'utf8'));
const nativeEnvironment = readFileSync(new URL('../src/environments/environment.native.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const generatedVersion = readFileSync(new URL('../src/generated/app-version.ts', import.meta.url), 'utf8');
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
assert.equal(angular.projects.vocora.architect.build.configurations.native.fileReplacements[0].with, 'src/environments/environment.native.ts');
assert.match(nativeEnvironment, /apiBaseUrl:\s*'https:\/\/vocora\.ir'/u);
assert.doesNotMatch(nativeEnvironment, /localhost|127\.0\.0\.1/u);
assert.match(generatedVersion, new RegExp(`WEB_APP_VERSION = '${packageJson.version.replaceAll('.', '\\.')}';`, 'u'));
assert.equal(scripts['mobile:sync'], 'npm run mobile:build && cap sync');

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
