import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(uiRoot, 'src', 'app');
const implementationRoot = path.join(appRoot, 'shared', 'voco-button');
const materialButtonPattern = /@angular\/material\/button(?:['"]|\/)/u;
const materialTemplatePattern = /(?:\bmatButton\b|\bmat-(?:button(?!-)|flat-button|raised-button|stroked-button|icon-button|fab|mini-fab)\b)/u;
const legacyClassPattern = /\bvocora-(?:button(?:--[a-z-]+)?|action-button)\b/u;

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:html|ts)$/u.test(entry.name) ? [absolute] : [];
  });
}

const violations = [];
for (const file of sourceFiles(appRoot)) {
  if (file.startsWith(`${implementationRoot}${path.sep}`)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (materialButtonPattern.test(source)) violations.push(`${path.relative(uiRoot, file)} imports Angular Material Button`);
  if (materialTemplatePattern.test(source)) violations.push(`${path.relative(uiRoot, file)} uses a Material button attribute`);
  if (legacyClassPattern.test(source)) violations.push(`${path.relative(uiRoot, file)} uses a legacy Vocora button class`);
}

assert.deepEqual(
  violations,
  [],
  `Use the shared voco Button API instead of importing Angular Material buttons directly.\n${violations.join('\n')}`,
);

const componentSource = fs.readFileSync(path.join(implementationRoot, 'voco-button.component.ts'), 'utf8');
const componentStyles = fs.readFileSync(path.join(implementationRoot, 'voco-button.component.scss'), 'utf8');
for (const variant of ['primary', 'secondary', 'success', 'warning', 'error', 'navigation']) {
  assert.match(componentSource, new RegExp(`voco-${variant}-button`, 'u'));
  assert.match(componentStyles, new RegExp(`voco-button--${variant}`, 'u'));
}
assert.match(componentSource, /@angular\/material\/button/u);
assert.doesNotMatch(componentSource, /readonly intent\s*=/u, 'semantic variant selection must stay in the voco selector');
assert.doesNotMatch(componentStyles, /#[\da-f]{3,8}\b/iu, 'voco button styles must use semantic tokens, not raw colors');
assert.match(componentStyles, /min-height:\s*44px/u);
assert.match(componentStyles, /\.voco-icon-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/su);
assert.match(componentStyles, /\.voco-audio-button\s*\{[^}]*min-width:\s*80px;[^}]*min-height:\s*80px;/su);
assert.match(componentStyles, /\.voco-button--navigation\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*box-shadow:\s*none;/su);

console.log('voco button architecture checks passed');
