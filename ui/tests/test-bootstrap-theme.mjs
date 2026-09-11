import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const styles = fs.readFileSync(path.join(uiRoot, 'src', 'styles.scss'), 'utf8');
const stylesRoot = path.join(uiRoot, 'src', 'styles');
const bootstrapTheme = fs.readFileSync(path.join(stylesRoot, '_bootstrap-theme.scss'), 'utf8');
const designSystem = fs.readFileSync(path.join(stylesRoot, '_vocora-design-system.scss'), 'utf8');
const classificationTemplate = fs.readFileSync(
  path.join(
    uiRoot,
    'src/app/shared/slide-exercise/library/components/classification/classification-slide.component.html'
  ),
  'utf8'
);
const featureThemeConsumers = [
  'src/app/features/collection-learning-path/exercises/scoped-vocabulary-practice/scoped-vocabulary-practice-exercise.component.scss',
  'src/app/features/collection-learning-path/exercises/vocabulary-mastery-check/vocabulary-mastery-check-exercise.component.scss',
  'src/app/features/review/review-page.component.scss',
].map((relativePath) => fs.readFileSync(path.join(uiRoot, relativePath), 'utf8'));

const designInclude = '@include vocora-design-system.apply();';
const bootstrapInclude = '@include bootstrap-theme.apply();';

assert.match(styles, /@use '\.\/styles\/bootstrap-theme' as bootstrap-theme;/u);
assert.ok(
  styles.indexOf(designInclude) >= 0 && styles.indexOf(designInclude) < styles.indexOf(bootstrapInclude),
  'Bootstrap theme mapping must be applied after the Vocora semantic layer.'
);

const semanticMappings = new Map([
  ['primary', 'primary'],
  ['secondary', 'secondary'],
  ['success', 'success'],
  ['info', 'information'],
  ['warning', 'warning'],
  ['danger', 'error'],
]);

for (const [bootstrapName, vocoraName] of semanticMappings) {
  assert.match(
    bootstrapTheme,
    new RegExp(`--bs-${bootstrapName}: var\\(--vocora-${vocoraName}\\);`, 'u'),
    `Bootstrap ${bootstrapName} must map to the corresponding Vocora semantic token.`
  );
  assert.match(
    bootstrapTheme,
    new RegExp(`--bs-${bootstrapName}-rgb: var\\(--vocora-${vocoraName}-rgb\\);`, 'u'),
    `Bootstrap ${bootstrapName} RGB utility token must map to the corresponding Vocora token.`
  );

  const rgbDefinitions = designSystem.match(new RegExp(`--vocora-${vocoraName}-rgb:`, 'gu')) ?? [];
  assert.equal(
    rgbDefinitions.length,
    2,
    `Vocora ${vocoraName} must provide RGB companions for both light and dark themes.`
  );
}

const publicVariableMappings = new Map([
  ['body-bg', 'surface-page'],
  ['body-bg-rgb', 'surface-page-rgb'],
  ['body-color', 'text-primary'],
  ['body-color-rgb', 'text-primary-rgb'],
  ['secondary-bg', 'surface-subtle'],
  ['secondary-bg-rgb', 'surface-subtle-rgb'],
  ['secondary-color', 'text-secondary'],
  ['secondary-color-rgb', 'text-secondary-rgb'],
  ['tertiary-bg', 'surface-raised'],
  ['tertiary-bg-rgb', 'surface-raised-rgb'],
  ['tertiary-color', 'text-disabled'],
  ['tertiary-color-rgb', 'text-disabled-rgb'],
  ['border-color', 'border'],
  ['link-color', 'primary'],
  ['link-color-rgb', 'primary-rgb'],
  ['link-hover-color', 'action-primary-hover'],
  ['link-hover-color-rgb', 'action-primary-hover-rgb'],
  ['light', 'surface-subtle'],
  ['light-rgb', 'surface-subtle-rgb'],
  ['dark', 'surface-inverse'],
  ['dark-rgb', 'surface-inverse-rgb'],
]);

for (const [bootstrapName, vocoraName] of publicVariableMappings) {
  assert.match(
    bootstrapTheme,
    new RegExp(`--bs-${bootstrapName}: var\\(--vocora-${vocoraName}\\);`, 'u'),
    `Bootstrap ${bootstrapName} must map to Vocora ${vocoraName}.`
  );
}

for (const [bootstrapName, vocoraName] of [
	['primary', 'primary'],
  ['success', 'success'],
  ['info', 'information'],
  ['warning', 'warning'],
  ['danger', 'error'],
]) {
  for (const [suffix, vocoraSuffix] of [
    ['bg-subtle', 'surface'],
    ['border-subtle', 'border'],
    ['text-emphasis', 'foreground'],
  ]) {
    assert.match(
      bootstrapTheme,
      new RegExp(`--bs-${bootstrapName}-${suffix}: var\\(--vocora-state-${vocoraName}-${vocoraSuffix}\\);`, 'u'),
      `Bootstrap ${bootstrapName} ${suffix} must use the corresponding Vocora state role.`
    );
  }
}

const declarationMap = (source) => new Map(
  [...source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/giu)]
    .map(([, name, value]) => [name, value.trim()])
);
const foundation = declarationMap(designSystem.split('// Layer B: Vocora semantic tokens')[0]);
const rgbCompanions = [...foundation]
  .filter(([name]) => name.endsWith('-rgb'));
assert.ok(rgbCompanions.length > 0, 'Foundation RGB companions must be present.');
for (const [rgbName, channels] of rgbCompanions) {
  const colorName = rgbName.slice(0, -4);
  const hex = foundation.get(colorName);
  assert.match(hex ?? '', /^#[0-9a-f]{6}$/iu, `${rgbName} must have a hex color companion.`);
  const expectedChannels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
    .join(', ');
  assert.equal(channels, expectedChannels, `${rgbName} must match ${colorName}.`);
}

const semanticThemeBlock = (themeName) => {
  const pattern = themeName === 'light'
    ? /:root,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\n\t\}/u
    : /html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\t\}/u;
  const match = designSystem.match(pattern);
  assert.ok(match, `Runtime design system must define the ${themeName} theme.`);
  return match[1];
};
for (const themeName of ['light', 'dark']) {
  const declarations = new Map([
    ...foundation,
    ...declarationMap(semanticThemeBlock(themeName)),
  ]);
  const resolve = (name, seen = new Set()) => {
    assert.ok(!seen.has(name), `Token reference cycle detected at ${name}.`);
    const value = declarations.get(name);
    assert.ok(value, `Missing RGB contract token ${name}.`);
    const reference = value.match(/^var\((--[a-z0-9-]+)\)$/iu);
    return reference ? resolve(reference[1], new Set([...seen, name])) : value;
  };
  for (const token of [
    'surface-page',
    'surface-base',
    'surface-raised',
    'surface-subtle',
    'surface-inverse',
    'text-primary',
    'text-secondary',
    'text-disabled',
    'primary',
    'secondary',
    'success',
    'information',
    'warning',
    'error',
    'action-primary',
    'action-primary-hover',
  ]) {
    const hex = resolve(`--vocora-${token}`);
    const channels = resolve(`--vocora-${token}-rgb`);
    const expectedChannels = [1, 3, 5]
      .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
      .join(', ');
    assert.equal(
      channels,
      expectedChannels,
      `${themeName} --vocora-${token}-rgb must match its full-color token.`
    );
  }
}

assert.doesNotMatch(
  classificationTemplate,
  /\bborder-secondary\b/u,
  'Routine classification borders must not use the brand-secondary utility.'
);
for (const consumer of featureThemeConsumers) {
  assert.doesNotMatch(
    consumer,
    /--v-(?:muted|border|surface|primary)\b/u,
    'Feature styles must not retain a competing semantic palette.'
  );
  assert.doesNotMatch(
    consumer,
    /#[0-9a-f]{3,8}\b|\brgba?\(/iu,
    'Migrated feature styles must consume canonical semantic colors.'
  );
}

assert.doesNotMatch(
  bootstrapTheme,
  /#[0-9a-f]{3,8}\b|\brgba?\(|!important/iu,
  'Bootstrap adapter must use public variables and Vocora tokens without raw colors or importance overrides.'
);
assert.doesNotMatch(
  bootstrapTheme,
  /\.(?:bg|text|border)-[a-z0-9-]+\s*\{/iu,
  'Bootstrap utilities must not be reimplemented in the adapter.'
);

const bootstrapDefinitionOwners = fs.readdirSync(stylesRoot)
  .filter((name) => name.endsWith('.scss'))
  .filter((name) => /--bs-[a-z0-9-]+\s*:/iu.test(fs.readFileSync(path.join(stylesRoot, name), 'utf8')));
assert.deepEqual(
  bootstrapDefinitionOwners,
  ['_bootstrap-theme.scss'],
  'The Bootstrap adapter must be the only application-owned Bootstrap variable owner.'
);

console.log('Bootstrap semantic theme contract passed.');
