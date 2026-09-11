import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const styles = fs.readFileSync(path.join(uiRoot, 'src', 'styles.scss'), 'utf8');
const bootstrapTheme = fs.readFileSync(path.join(uiRoot, 'src', 'styles', '_bootstrap-theme.scss'), 'utf8');
const designSystem = fs.readFileSync(path.join(uiRoot, 'src', 'styles', '_vocora-design-system.scss'), 'utf8');

const designInclude = '@include vocora-design-system.apply();';
const bootstrapInclude = '@include bootstrap-theme.apply();';

assert.match(styles, /@use '\.\/styles\/bootstrap-theme' as bootstrap-theme;/u);
assert.ok(
  styles.indexOf(designInclude) >= 0 && styles.indexOf(designInclude) < styles.indexOf(bootstrapInclude),
  'Bootstrap theme mapping must be applied after the Vocora design system.'
);

const semanticMappings = [
  ['primary', 'action-primary'],
  ['secondary', 'text-secondary'],
  ['success', 'success'],
  ['info', 'information'],
  ['warning', 'warning'],
  ['danger', 'error'],
];

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

assert.match(
  bootstrapTheme,
  /\.bg-light\s*\{[^}]*background:\s*color-mix\(\s*in srgb,\s*var\(--vocora-surface-base\) 92%,\s*var\(--vocora-border\)\s*\)\s*!important;/u,
  'Bootstrap bg-light must remain distinct from bg-white while following the active Vocora theme.'
);
assert.match(
  bootstrapTheme,
  /\.text-body\s*\{[^}]*color:\s*var\(--vocora-text-primary\)\s*!important;/u,
  'Bootstrap text-body must retain readable Vocora text contrast in both themes.'
);

assert.doesNotMatch(
  bootstrapTheme,
  /#[0-9a-f]{3,8}\b/iu,
  'Bootstrap theme mapping must reference Vocora tokens instead of owning raw color values.'
);

console.log('Bootstrap semantic theme contract passed.');
