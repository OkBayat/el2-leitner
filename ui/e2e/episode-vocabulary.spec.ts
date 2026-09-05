import { expect, test } from '@playwright/test';

test('episode cover, levels and vocabulary connect to Leitner without activating unrelated words', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    Object.defineProperty(window, '__episodeSpoken', { value: spoken });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, getVoices() { return []; }, speak(utterance: SpeechSynthesisUtterance) { spoken.push(utterance.text); },
    } });
  });
  await page.goto('/register');
  await page.getByLabel('Email').fill(`e2e-episode-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  await page.getByTestId('open-bbc-listening').click();
  const card = page.getByTestId('bbc-lesson-limiting-screen-time-for-children');
  await expect(card.getByTestId('episode-level')).toHaveText('Intermediate');
  await expect(card.getByTestId('start-bbc-test-1')).toContainText('Medium');
  const cover = card.getByTestId('bbc-episode-cover');
  await cover.scrollIntoViewIfNeeded();
  await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await card.getByTestId('episode-vocabulary-link').click();
  await expect(page).toHaveURL(/\/limiting-screen-time-for-children\/vocabulary$/u);
  await expect(page.locator('.vocabulary-card')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'intentional', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'landslide', exact: true })).toHaveCount(0);
  await expect(page.locator('.definition')).toHaveCount(6);
  await expect(page.locator('.example')).toHaveCount(6);
  const vocabulary = await page.evaluate(async () => (await fetch('/api/listening/bbc/lessons/limiting-screen-time-for-children/vocabulary')).json());
  expect(vocabulary.subscribed).toBe(false);
  expect(vocabulary.entries.every((entry: any) => entry.progress.state === 'new')).toBe(true);
  const before = await page.evaluate(async () => (await fetch('/api/state')).json());
  const wasActive = new Set(
    before.state.words
      .filter((word: any) => word.box > 0 || word.introducedOn)
      .map((word: any) => word.id)
  );
  const first = vocabulary.entries[0];
  await page.getByTestId(`pronounce-episode-word-${first.vocabularyId}`).click();
  expect(await page.evaluate(() => (window as any).__episodeSpoken)).toEqual([first.term]);
  await page.getByTestId(`add-episode-word-${first.vocabularyId}`).click();
  await expect(page.getByTestId(`episode-word-status-${first.vocabularyId}`)).toHaveText('In Leitner Box 1');
  await expect(page.getByTestId(`add-episode-word-${first.vocabularyId}`)).toHaveCount(0);
  await page.getByTestId('add-all-episode-vocabulary').click();
  await expect(page.locator('[data-testid^="episode-word-status-"]')).toHaveCount(6);
  await expect(page.getByTestId('add-all-episode-vocabulary')).toBeDisabled();
  const after = await page.evaluate(async () => (await fetch('/api/state')).json());
  const episodeIds = new Set(vocabulary.entries.map((entry: any) => entry.vocabularyId));
  const active = after.state.words.filter((word: any) => word.box > 0 || word.introducedOn);
  const episodeActive = active.filter((word: any) => episodeIds.has(word.id));
  expect(episodeActive.map((word: any) => word.id).sort()).toEqual([...episodeIds].sort());
  expect(episodeActive.every((word: any) => word.box === 1 && word.attempts === 0)).toBe(true);
  const unrelatedNewlyActive = active.filter((word: any) => !episodeIds.has(word.id) && !wasActive.has(word.id));
  expect(unrelatedNewlyActive).toEqual([]);
  await page.reload();
  await expect(page.locator('[data-testid^="episode-word-status-"]')).toHaveCount(6);
  await expect(page.getByTestId('add-all-episode-vocabulary')).toBeDisabled();
  await page.getByRole('link', { name: 'Back to episodes' }).click();
  await expect(page).toHaveURL(/\/bbc-6-minute-english$/u);
  await page.getByTestId('bbc-lesson-limiting-screen-time-for-children').getByTestId('start-bbc-test-1').click();
  await expect(page.getByTestId('bbc-listening-practice-page')).toBeVisible();
  await expect(page.locator('[data-testid^="listening-question-"]')).toHaveCount(13);
  await expect(page.getByRole('link', { name: 'Episode vocabulary' })).toBeVisible();
});
