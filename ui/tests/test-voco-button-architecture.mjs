import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { extractCssSyntax, extractInlineStyles } from './design-system-architecture.mjs';

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
const vocoDeepImportPattern = /(?:^|\/)voco-button\/.+$/u;
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
  const extension = path.extname(file).toLowerCase();
  if (['.scss', '.css', '.sass', '.less'].includes(extension)) {
    return [extractCssSyntax(source, { lineComments: extension !== '.css' })];
  }
  return extension === '.ts'
    ? extractInlineStyles(source).map((style) => extractCssSyntax(style))
    : [];
}

function targetsPrivateVocoStyles(file, source) {
  return privateVocoStyleSources(file, source).some(
    (style) => internalVocoStylePattern.test(style) || nestedNativeControlPattern.test(style),
  );
}

function privateVocoDeepImports(source) {
  const syntax = ts.createSourceFile(
    'consumer.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports = [];
  const isModuleSpecifierLiteral = (node) => (
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
  );
  const record = (moduleSpecifier) => {
    if (moduleSpecifier && vocoDeepImportPattern.test(moduleSpecifier.text)) {
      imports.push(moduleSpecifier.text);
    }
  };
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && isModuleSpecifierLiteral(node.moduleSpecifier)
    ) {
      record(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && isModuleSpecifierLiteral(node.moduleReference.expression)
    ) {
      record(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && isModuleSpecifierLiteral(node.arguments[0])
    ) {
      record(node.arguments[0]);
    } else if (
      ts.isImportTypeNode(node)
      && ts.isLiteralTypeNode(node.argument)
      && isModuleSpecifierLiteral(node.argument.literal)
    ) {
      record(node.argument.literal);
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return imports;
}

function isSelectionInteractionTag(tag) {
  return /(?:class\s*=\s*["'][^"']*\b(?:choice-option|classification-item|cloze-choice-blank)\b|aria-(?:checked|current|pressed)|data-testid\s*=\s*["']selection-option["']|\[attr\.data-state\]|\[attr\.data-item-id\])/u.test(tag);
}

assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction type="button">Reset current slide</button>'), false);
assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction class="speech-replay">Play pronunciation</button>'), false);
assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction class="library-item">Open library item</button>'), false);
assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction aria-label="Move item up">↑</button>'), false);
assert.equal(isSelectionInteractionTag('<button vocoButtonInteraction class="choice-option" [attr.aria-checked]="selected">'), true);

for (const [metadata, expectedSelector] of [
  ["styles: ['.voco-button { width: 100%; }']", '.voco-button'],
  ['styles: `voco-primary-button button { min-height: 60px; }`', 'voco-primary-button button'],
  ['styles: [`.voco-icon-button--selected { color: red; }`]', '.voco-icon-button--selected'],
  ["styles: '.voco-audio-button { width: 100%; }'", '.voco-audio-button'],
  ["styles: ['voco-secondary-link a { display: block; }']", 'voco-secondary-link a'],
  ["styles: ['voco-icon-button > button { width: 100%; }']", 'voco-icon-button > button'],
  ["styles: ['voco-navigation-link .voco-button { width: 100%; }']", 'voco-navigation-link .voco-button'],
]) {
  assert.equal(
    targetsPrivateVocoStyles(
      'src/app/features/example/example.component.ts',
      `import { Component } from '@angular/core'; @Component({ ${metadata} }) export class ExampleComponent {}`,
    ),
    true,
    `Angular inline styles must not target private Voco implementation selectors: ${expectedSelector}`,
  );
}
assert.equal(
  targetsPrivateVocoStyles(
    'src/app/features/example/aliased.component.ts',
    "import { Component as NgComponent } from '@angular/core'; @NgComponent({ styles: '.voco-button { width: 100%; }' }) export class ExampleComponent {}",
  ),
  true,
  'Aliased Angular Component decorators must be scanned.',
);
assert.equal(
  targetsPrivateVocoStyles(
    'src/app/features/example/example.component.ts',
    `const selectorDocumentation = '.voco-button';`,
  ),
  false,
  'Non-style TypeScript strings must not be treated as CSS selectors.',
);
assert.equal(
  targetsPrivateVocoStyles(
    'src/app/features/example/example.component.ts',
    "import { Component } from '@angular/core'; @Component({ styles: 'voco-primary-button { width: 100%; }' }) export class ExampleComponent {}",
  ),
  false,
  'Feature layout may target a public Voco host.',
);
assert.equal(
  targetsPrivateVocoStyles(
    'src/app/features/example/example.component.ts',
    "import { Component } from '@angular/core'; // @Component({ styles: '.voco-button { width: 100%; }' })\nexport class ExampleComponent {}",
  ),
  false,
  'Commented-out Angular metadata must not be treated as live component styles.',
);
assert.equal(
  targetsPrivateVocoStyles(
    'src/app/features/example/example.component.ts',
    "import { Component } from '@angular/core'; @Component({ styles: '/* .voco-button { width: 100%; } */' }) export class ExampleComponent {}",
  ),
  false,
  'CSS comments in Angular styles must not be treated as live selectors.',
);
assert.equal(
  targetsPrivateVocoStyles(
    'src/app/features/example/example.component.ts',
    "import { Component } from '@angular/core'; @Component({ template: '<p>.voco-button</p>', styles: 'voco-primary-button { width: 100%; }' }) export class ExampleComponent {}",
  ),
  false,
  'Template text must not be treated as component CSS.',
);
for (const extension of ['scss', 'css', 'sass', 'less']) {
  assert.equal(
    targetsPrivateVocoStyles(
      `src/app/features/example/example.component.${extension}`,
      'voco-primary-button > button { width: 100%; }',
    ),
    true,
    `External .${extension} stylesheets must enforce the nested-control boundary.`,
  );
  assert.equal(
    targetsPrivateVocoStyles(
      `src/app/features/example/example.component.${extension}`,
      'voco-primary-button { width: 100%; }',
    ),
    false,
    `External .${extension} stylesheets may target a public Voco host for layout.`,
  );
}

for (const privateModule of [
  'voco-button-foundation',
  'voco-link-foundation',
  'voco-button.types',
  'internal/helpers',
]) {
  const moduleSpecifier = `../../shared/voco-button/${privateModule}`;
  assert.deepEqual(
    privateVocoDeepImports(
      `import { PrivateVocoSymbol } from '${moduleSpecifier}';`,
    ),
    [moduleSpecifier],
    `Consumers must not deep-import private Voco module ${privateModule}.`,
  );
}
assert.deepEqual(
  privateVocoDeepImports(
    "export { VocoLinkFoundation } from '../../shared/voco-button/voco-link-foundation';",
  ),
  ['../../shared/voco-button/voco-link-foundation'],
  'Consumers must not re-export private Voco implementation modules.',
);
for (const source of [
  "const foundation = await import('../../shared/voco-button/voco-button-foundation');",
  'const foundation = await import(`../../shared/voco-button/voco-button-foundation`);',
  "type Foundation = import('../../shared/voco-button/voco-button-foundation').VocoButtonFoundation;",
  "import Foundation = require('../../shared/voco-button/voco-button-foundation');",
]) {
  assert.deepEqual(
    privateVocoDeepImports(source),
    ['../../shared/voco-button/voco-button-foundation'],
    'Executable and type-level private Voco deep imports must be rejected.',
  );
}
assert.deepEqual(
  privateVocoDeepImports(
    "import { VocoPrimaryButtonComponent } from '../../shared/voco-button';",
  ),
  [],
  'Consumers may import the public Voco barrel.',
);
assert.deepEqual(
  privateVocoDeepImports(
    "const documentation = \"import from '../../shared/voco-button/voco-button-foundation'\";",
  ),
  [],
  'Ordinary TypeScript strings must not be treated as imports.',
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
    violations.push(`${relative(file)} targets private voco implementation details`);
  }
  for (const moduleSpecifier of file.endsWith('.ts') ? privateVocoDeepImports(source) : []) {
    violations.push(`${relative(file)} deep-imports private voco implementation module ${moduleSpecifier}`);
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
