import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const changes = [
  ['ui/e2e/bbc-listening.spec.ts', [
    ["  await expect(page.getByTestId('open-bbc-listening')).toBeVisible({ timeout: 10_000 });", "  await expect(page.locator('.path-day.is-today [data-activity=\"listening\"]')).toBeVisible({ timeout: 10_000 });"],
    ["  await page.getByTestId('open-bbc-listening').click();", "  await page.locator('.path-day.is-today [data-activity=\"listening\"]').click();\n  await page.getByRole('dialog').getByRole('link', { name: 'Start', exact: true }).click();"],
  ]],
  ['ui/e2e/episode-vocabulary.spec.ts', [
    ["  await page.getByTestId('open-bbc-listening').click();", "  await page.locator('.path-day.is-today [data-activity=\"listening\"]').click();\n  await page.getByRole('dialog').getByRole('link', { name: 'Start', exact: true }).click();"],
  ]],
  ['ui/src/app/features/home/home-page.component.scss', [
    [".path-popover {\n  position: relative;", ".path-popover {\n  box-sizing: border-box;\n  position: relative;"],
  ]],
];

for (const [path, edits] of changes) {
  let content = readFileSync(path, 'utf8');
  for (const [before, after] of edits) {
    assert.equal(content.split(before).length - 1, 1, `${path}: expected exactly one source anchor`);
    content = content.replace(before, after);
  }
  writeFileSync(path, content);
  console.log(`Updated ${path}`);
}
