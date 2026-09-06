import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// One-time, exact-match migration for PR 76. Remove this helper and its workflow after the commit.
// Every surrounding test and assertion remains byte-for-byte unchanged.
const changes = [
  ['ui/e2e/vocora.spec.ts', [
    ["  const houseStatus = page.getByTestId('house-status');", "  await page.getByRole('link', { name: 'Open learning overview' }).click();\n  await expect(page).toHaveURL(/\\/overview$/u);\n  const houseStatus = page.getByTestId('house-status');"],
  ]],
  ['ui/e2e/sentence-practice.spec.ts', [
    ["\tawait expect(page.getByTestId('start-sentence-practice')).toBeVisible({ timeout: 10_000 });", "\tawait page.getByTestId('home-box-one').click();\n\tawait expect(page.getByTestId('start-sentence-practice')).toBeVisible({ timeout: 10_000 });"],
  ]],
  ['ui/e2e/sentence-answer.spec.ts', [
    ["\t\t\tawait page.getByTestId('start-sentence-practice').click();", "\t\t\tawait page.getByTestId('home-box-one').click();\n\t\t\tawait page.getByTestId('start-sentence-practice').click();"],
  ]],
  ['ui/e2e/shadowing.spec.ts', [
    ["  await page.getByTestId('start-shadowing').click();", "  await page.getByTestId('home-shadowing').click();\n  await page.getByTestId('start-shadowing').click();"],
  ]],
  ['ui/e2e/shadowing-audio.spec.ts', [
    ["  await page.getByRole('button', { name: 'Stop recording', exact: true })).click();", "  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();"],
  ]],
  ['back/tests/integration/home-timeline.mysql.test.js', [
    ["AS day, d.attempt_count\n", "AS day\n"],
    ["assert.deepEqual(evidence.map(row => [row.day, Number(row.attempt_count)]), [['2026-09-04', 1], ['2026-09-05', 1]]);", "assert.deepEqual(evidence.map(row => row.day), ['2026-09-04', '2026-09-05']);"],
  ]],
];
const updated = changes.map(([path, edits]) => {
  let content = readFileSync(path, 'utf8');
  for (const [before, after] of edits) {
    assert.equal(content.split(before).length - 1, 1, `${path}: expected one exact source anchor; refusing an ambiguous edit.`);
    content = content.replace(before, after);
  }
  return [path, content];
});
for (const [path, content] of updated) {
  writeFileSync(path, content);
  console.log(`Updated test entry point: ${path}`);
}
