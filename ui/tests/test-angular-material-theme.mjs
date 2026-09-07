import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const theme = fs.readFileSync(path.join(uiRoot, 'src', 'styles', '_angular-material-theme.scss'), 'utf8');
const styles = fs.readFileSync(path.join(uiRoot, 'src', 'styles.scss'), 'utf8');
const designSystem = fs.readFileSync(path.join(uiRoot, 'src', 'styles', '_vocora-design-system.scss'), 'utf8');

const expectedTokens = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'primary-fixed', 'on-primary-fixed', 'on-primary-fixed-variant', 'primary-fixed-dim', 'inverse-primary',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'secondary-fixed', 'on-secondary-fixed', 'on-secondary-fixed-variant', 'secondary-fixed-dim',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'tertiary-fixed', 'on-tertiary-fixed', 'on-tertiary-fixed-variant', 'tertiary-fixed-dim',
  'error', 'on-error', 'error-container', 'on-error-container',
  'surface', 'on-surface', 'on-surface-variant', 'surface-bright', 'surface-container',
  'surface-container-high', 'surface-container-highest', 'surface-container-low', 'surface-container-lowest',
  'surface-dim', 'surface-tint', 'surface-variant', 'inverse-surface', 'inverse-on-surface',
  'background', 'on-background', 'neutral-variant20', 'neutral10', 'outline', 'outline-variant', 'scrim', 'shadow',
];

for (const token of expectedTokens) {
  assert.match(
    theme,
    new RegExp(`--mat-sys-${token}:\\s*var\\(--vocora-[^)]+\\);`),
    `Material token ${token} must map to a Vocora design token.`,
  );
}

assert.doesNotMatch(
  theme,
  /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/iu,
  'Angular Material theme adapter must not own raw colors.',
);
assert.doesNotMatch(
  theme,
  /--(?:mdc|mat-(?!sys-))[^:]+:/u,
  'Component-specific Material color overrides must not live in the system color adapter.',
);
assert.match(designSystem, /--vocora-neutral-black:\s*#[0-9a-f]{6};/iu, 'Shared shadow/scrim color must live in the Vocora design system.');
assert.doesNotMatch(styles, /angular-material-defaults/u, 'Legacy Angular Material color defaults must not remain wired into global styles.');
assert.ok(
  styles.indexOf('@include angular-material-theme.apply();') > styles.indexOf('@include mat.theme(('),
  'Vocora Angular Material color overrides must be applied after the base Material theme.',
);

console.log('Angular Material theme contract passed.');
