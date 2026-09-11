import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const bundle = resolve(import.meta.dirname, '../dist/browser');
assert.equal(existsSync(join(bundle, 'index.html')), true, 'Run npm run mobile:build before checking the native bundle.');
assert.equal(existsSync(join(bundle, 'service-worker.js')), false, 'Native bundles must not contain the web service worker.');

const textFiles = [];
const collect = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (['.html', '.js', '.json', '.css'].includes(extname(entry.name))) textFiles.push(path);
  }
};
collect(bundle);

const source = textFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
assert.doesNotMatch(source, /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/api(?:\/|["'`])/u);
assert.doesNotMatch(source, /https:\/\/dev\.vocora\.ir/u);

console.info(`Native bundle contract passed across ${textFiles.length} text assets.`);
