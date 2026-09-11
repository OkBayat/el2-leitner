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
  ['primary', 'information'],
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
