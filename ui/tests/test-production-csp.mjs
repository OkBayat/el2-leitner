import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(testDir, '..', 'dist', 'browser', 'index.html');
assert.ok(fs.existsSync(indexPath), 'Production index.html must exist before CSP validation.');

const html = fs.readFileSync(indexPath, 'utf8');
assert.doesNotMatch(html, /\son[a-z]+\s*=/iu, 'Production HTML must not contain inline event handlers blocked by script-src-attr none.');
assert.match(html, /<link[^>]+rel=["']stylesheet["'][^>]*>/iu, 'Production HTML must load the compiled stylesheet.');

console.log('Angular production CSP contract passed.');
