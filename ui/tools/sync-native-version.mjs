import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
if (!match) throw new Error('ui/package.json version must use MAJOR.MINOR.PATCH.');

const explicitIndex = process.argv.indexOf('--build-number');
const defaultBuild = Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
const buildNumber = explicitIndex >= 0 ? Number(process.argv[explicitIndex + 1]) : defaultBuild;
if (!Number.isSafeInteger(buildNumber) || buildNumber <= 0 || buildNumber > 2_100_000_000) {
  throw new Error('--build-number must be a positive integer no greater than 2100000000.');
}

function replaceChecked(path, pattern, replacement, expectedMatches) {
  const absolute = resolve(root, path);
  const source = readFileSync(absolute, 'utf8');
  const matches = [...source.matchAll(pattern)].length;
  if (matches !== expectedMatches) {
    throw new Error(`${path} expected ${expectedMatches} version field(s), found ${matches}.`);
  }
  writeFileSync(absolute, source.replace(pattern, replacement));
}

replaceChecked('android/app/build.gradle', /^\s*versionCode\s+\d+\s*$/gmu, `        versionCode ${buildNumber}`, 1);
replaceChecked('android/app/build.gradle', /^\s*versionName\s+"[^"]+"\s*$/gmu, `        versionName "${version}"`, 1);
replaceChecked('ios/App/App.xcodeproj/project.pbxproj', /CURRENT_PROJECT_VERSION = [^;]+;/gu, `CURRENT_PROJECT_VERSION = ${buildNumber};`, 2);
replaceChecked('ios/App/App.xcodeproj/project.pbxproj', /MARKETING_VERSION = [^;]+;/gu, `MARKETING_VERSION = ${version};`, 2);
replaceChecked('src/generated/app-version.ts', /WEB_APP_VERSION = '[^']+';/gu, `WEB_APP_VERSION = '${version}';`, 1);

console.info(`Synchronized Vocora ${version} build ${buildNumber}.`);
