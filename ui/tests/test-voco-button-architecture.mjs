import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractInlineStyles } from './design-system-architecture.mjs';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(uiRoot, 'src', 'app');
const implementationRoot = path.join(appRoot, 'shared', 'voco-button');
const materialButtonPattern = /@angular\/material\/button(?:['"]|\/)/u;
const materialTemplatePattern = /(?:\bmatButton\b|\bmat-(?:button(?!-)|flat-button|raised-button|stroked-button|icon-button|fab|mini-fab)\b)/u;
const legacyClassPattern = /\bvocora-(?:button(?:--[a-z-]+)?|action-button|audio-action(?:--[a-z-]+)?|(?:plain|primary|secondary)-icon-action(?:--[a-z-]+)?)\b/u;
const nativeVocoClickPattern = /<voco-[a-z-]+\b(?:(?!>).)*\(click\)=/su;
const staleMaterialButtonVariablePattern = /--(?:mat-button|mdc-(?:filled|outlined|text|protected|icon)-button)-[a-z-]+/u;
const internalVocoStylePattern = /\.(?:voco-button|voco-icon-button|voco-audio-button)(?:--[a-z-]+)?\b/u;
const nestedNativeControlPattern = /voco-(?:primary-button|secondary-button|success-button|warning-button|error-button|navigation-button|primary-link|secondary-link|navigation-link|icon-button|icon-link|audio-button)(?:\[[^\]]+\]|\.[a-z-]+|#[a-z-]+|:[a-z-]+)*(?:\s+|\s*>\s*)(?:button|a)\b/u;
const publicComponents = [
  ['VocoPrimaryButtonComponent', 'voco-primary-button', 'primary'],
  ['VocoSecondaryButtonComponent', 'voco-secondary-button', 'secondary'],
  ['VocoSuccessButtonComponent', 'voco-success-button', 'success'],
  ['VocoWarningButtonComponent', 'voco-warning-button', 'warning'],
  ['VocoErrorButtonComponent', 'voco-error-button', 'error'],
  ['VocoNavigationButtonComponent', 'voco-navigation-button', 'navigation'],
];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:html|ts|scss|css|sass|less)$/u.test(entry.name) ? [absolute] : [];
  });
}

function relative(file) {
  return path.relative(uiRoot, file);
}

function privateVocoStyleSources(file, source) {
  if (/\.(?:scss|css|sass|less)$/u.test(file)) return [source];
  return file.endsWith('.ts') ? extractInlineStyles(source) : [];
}

function targetsPrivateVocoStyles(file, source) {
  return privateVocoStyleSources(file, source).some((style) => internalVocoStylePattern.test(style));
}

function isSelectionInteractionTag(tag) {
  return /(?:class\s*=\s*["'][^"']*\b(?:choice-option|classification-item|cloze-choice-blank)\b|aria-(?:checked|current|pressed)|data-testid\s*=\s*["']selection-option["']|\[attr\.data-state\]|\[attr\.data-item-id\])/u.test(tag);
}

assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction type="button">Reset current slide</button>'), false);
assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction class="speech-replay">Play pronunciation</button>'), false);
assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction class="library-item">Open library item</button>'), false);
assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction aria-label="Move item up">↑</button>'), false);
assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction class="choice-option" [attr.aria-checked]="selected">'), true);

for (const inlineStyle of [
  '.voco-button { min-width: 10rem; }',
  '.voco-icon-button--selected { color: inherit; }',
  '.voco-audio-button { width: 100%; }',
]) {
  assert.equal(
    targetsPrivateVocoStyles(
      'src/app/features/example/example.component.ts',
      `import { Component } from '@angular/core'; @Component({ styles: [\`${inlineStyle}\`] }) export class ExampleComponent {}`,
    ),
    true,
    `Angular inline styles must not target private Voco classes: ${inlineStyle}`,
  );
}
assert.equal(
  targetsPrivateVocoStyles(
    'src/app/features/example/example.component.ts',
    `const selectorDocumentation = '.voco-button';`,
  ),
  false,
  'Non-style TypeScript strings must not be treated as CSS selectors.',
);

const violations = [];
for (const file of sourceFiles(appRoot)) {
  if (file.startsWith(`${implementationRoot}${path.sep}`)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (materialButtonPattern.test(source)) violations.push(`${relative(file)} imports Angular Material Button`);
  if (materialTemplatePattern.test(source)) violations.push(`${relative(file)} uses a Material button attribute`);
  if (legacyClassPattern.test(source)) violations.push(`${relative(file)} uses a legacy Vocora button class`);
  if (nativeVocoClickPattern.test(source)) violations.push(`${relative(file)} binds native click instead of voco activation`);
  if (staleMaterialButtonVariablePattern.test(source)) violations.push(`${relative(file)} owns a Material button CSS variable`);
  if (targetsPrivateVocoStyles(file, source)) {
    violations.push(`${relative(file)} targets a private voco implementation class`);
  }
  if (!file.endsWith('.spec.ts') && nestedNativeControlPattern.test(source)) {
    violations.push(`${relative(file)} reaches into a voco component's native control`);
  }
  if (/--vocora-component-action-(?:background|foreground|edge|border)/u.test(source)) {
    violations.push(`${relative(file)} overrides voco visual intent from feature code`);
  }
  if (/\bVocoButtonComponent\b/u.test(source)) {
    violations.push(`${relative(file)} imports the removed generic public component`);
  }
  for (const match of source.matchAll(/<button\b(?:(?!>).)*\bvocoButtonInteraction\b(?:(?!>).)*>/gsu)) {
    if (!isSelectionInteractionTag(match[0])) {
      violations.push(`${relative(file)} uses vocoButtonInteraction outside an approved selection control`);
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `Use semantic voco APIs and keep Material/Button visuals private. Test specs may query nested native controls; feature code and styles may not.\n${violations.join('\n')}`,
);

const implementationFiles = sourceFiles(implementationRoot);
const implementationSource = implementationFiles
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
const implementationStyles = implementationFiles
  .filter((file) => /\.(?:scss|css|sass|less)$/u.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
const publicSource = fs.readFileSync(path.join(implementationRoot, 'voco-text-button.components.ts'), 'utf8');
const publicApiSource = [
  'voco-text-button.components.ts',
  'voco-link.components.ts',
  'voco-icon-button.component.ts',
  'voco-icon-link.component.ts',
  'voco-audio-button.component.ts',
].map((file) => fs.readFileSync(path.join(implementationRoot, file), 'utf8')).join('\n');
const foundationSource = fs.readFileSync(path.join(implementationRoot, 'voco-button-foundation.ts'), 'utf8');
const materialImplementationSource = [
  foundationSource,
  publicSource,
  fs.readFileSync(path.join(implementationRoot, 'voco-text-button.component.html'), 'utf8'),
].join('\n');

for (const [className, selector, intent] of publicComponents) {
  assert.match(publicSource, new RegExp(`export class ${className}\\b`, 'u'));
  assert.match(publicSource, new RegExp(`selector:\\s*['"]${selector}['"]`, 'u'));
  assert.match(publicSource, new RegExp(`readonly intent\\s*=\\s*['"]${intent}['"]`, 'u'));
}

assert.doesNotMatch(implementationSource, /\bclass\s+VocoButtonComponent\b/u);
assert.doesNotMatch(implementationSource, /selector:\s*['"][^'"]*,[^'"]*voco-/u);
assert.doesNotMatch(implementationSource, /nativeElement\.localName|\bIDENTITIES\b/u);
assert.doesNotMatch(
  publicApiSource,
  /(?:@Input[^\n]*(?:variant|intent)|(?:variant|intent)\s*=\s*input(?:\.required)?\b)/u,
  'semantic intent must not be a public input',
);
assert.match(foundationSource, /abstract class VocoButtonFoundation\b/u);
assert.match(materialImplementationSource, /@angular\/material\/button/u);
assert.doesNotMatch(implementationStyles, /#[\da-f]{3,8}\b/iu, 'voco button styles must use semantic tokens, not raw colors');
assert.match(implementationStyles, /min-height:\s*44px/u);
assert.match(implementationStyles, /\.voco-icon-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/su);
assert.match(implementationStyles, /\.voco-audio-button\s*\{[^}]*width:\s*80px;[^}]*min-width:\s*80px;[^}]*height:\s*80px;[^}]*min-height:\s*80px;/su);
assert.match(implementationStyles, /\.voco-button--navigation\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*box-shadow:\s*none;/su);
assert.match(implementationStyles, /\.voco-button--navigation[^,{]*:active\s*\{[^}]*transform:\s*none;/su);
assert.match(
  materialImplementationSource,
  /mat-(?:flat-|stroked-|raised-)?button/u,
  'navigation must retain Material ripple, keyboard, and focus behavior',
);

for (const file of sourceFiles(appRoot).filter((item) => !item.startsWith(`${implementationRoot}${path.sep}`))) {
  if (!/\.(?:html|ts)$/u.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<voco-(?:icon-button|icon-link|audio-button)\b([^>]*)>/gu)) {
    assert.match(
      match[1],
      /(?:aria-label|\[ariaLabel\])\s*=/u,
      `${relative(file)} uses an icon-only voco control without an accessible name`,
    );
  }
  for (const match of source.matchAll(/<voco-audio-button\b[^>]*>([\s\S]*?)<\/voco-audio-button>/gu)) {
    const visibleText = match[1].replace(/<[^>]+>/gu, '').replace(/\{\{[\s\S]*?\}\}/gu, '').trim();
    assert.equal(visibleText, '', `${relative(file)} uses square voco-audio-button for textual content: ${visibleText}`);
  }
}

const dashboardSource = fs.readFileSync(
  path.join(appRoot, 'features', 'dashboard', 'dashboard-page.component.html'),
  'utf8',
);
assert.match(dashboardSource, /<voco-primary-link\s+routerLink="\/review"[\s\S]*?>Start today's review<\/voco-primary-link>/u);
assert.match(dashboardSource, /<voco-secondary-link\s+routerLink="\/review"\s+\[queryParams\]="\{ mode: 'box1' \}"[\s\S]*?>Free practice: Box 1<\/voco-secondary-link>/u);
assert.match(dashboardSource, /<voco-secondary-link[\s\S]*?routerLink="\/sentence"[\s\S]*?\[queryParams\]="\{ house: 1 \}"[\s\S]*?>Sentence practice: Box 1<\/voco-secondary-link>/u);

console.log('voco button architecture checks passed');
