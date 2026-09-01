import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'e2e-admin@example.com';
const ADMIN_PASSWORD = 'password123';

async function authenticate(page: Page, email = ADMIN_EMAIL): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  const registered = await page.waitForURL(/\/dashboard$/u, { timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
  if (!registered) {
    await expect(page.getByRole('alert')).toContainText('already registered');
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in to Vocora' }).click();
  }
  await expect(page).toHaveURL(/\/dashboard$/u);
  await expect(page.getByText("Today's plan")).toBeVisible({ timeout: 10_000 });
}

async function firstDueTerm(page: Page): Promise<string> {
  let term = '';
  await expect.poll(async () => {
    term = await page.evaluate(async () => {
      const response = await fetch('/api/state', { credentials: 'include' });
      const payload = await response.json();
      const words = Array.isArray(payload.state?.words) ? payload.state.words : [];
      const today = new Date().toLocaleDateString('en-CA');
      const due = words
        .filter((word: any) => word.box > 0 && !word.masteredAt && word.due && word.due <= today && (!word.blockedUntil || word.blockedUntil <= today))
        .sort((a: any, b: any) => String(a.due).localeCompare(String(b.due)) || b.mistakes - a.mistakes || a.number - b.number);
      return String(due[0]?.term || '');
    });
    return term;
  }, { timeout: 10_000, message: 'learner state should expose at least one due review card' }).not.toBe('');
  return term;
}

test('English LTR Angular app preserves the complete learner and library flow', async ({ page }) => {
  await authenticate(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByText('Vocora', { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Today's plan")).toBeVisible();

  const houseStatus = page.getByTestId('house-status');
  await expect(houseStatus).toBeVisible();
  await expect(houseStatus.locator('mat-progress-bar')).toHaveCount(0);
  const houseRows = houseStatus.locator('.leitner-row');
  await expect(houseRows).toHaveCount(5);
  for (const [index, expectedSegments] of [1, 2, 3, 7, 14].entries()) {
    await expect(houseRows.nth(index).locator('.leitner-segment')).toHaveCount(expectedSegments);
  }
  const segmentWidths = await houseRows.locator('.leitner-segments').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  expect(segmentWidths).toHaveLength(5);
  for (let index = 1; index < segmentWidths.length; index += 1) expect(segmentWidths[index]).toBeGreaterThan(segmentWidths[index - 1]);

  await page.goto('/words');
  await expect(page.getByRole('heading', { name: 'Word Bank' })).toBeVisible();
  await page.getByLabel('Search').fill('Monday');
  await expect(page.getByText('Monday', { exact: true })).toBeVisible();

  const dueTerm = await firstDueTerm(page);

  await page.goto('/review');
  await expect(page.getByTestId('review-layout')).toBeVisible();
  await expect(page.locator('app-shell')).toHaveCount(0);
  await expect(page.locator('.sidebar, .topbar, .mobile-nav')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByTestId('review-session-bar')).toBeVisible();
  const answerInput = page.getByLabel('Your answer');
  await expect(answerInput).toBeVisible();
  await expect(answerInput).toBeFocused();
  await answerInput.fill(dueTerm);
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();

  const savedReview = await page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    const payload = await response.json();
    return payload.state.history.at(-1);
  });
  expect(savedReview.correct).toBe(true);
  expect(savedReview.term).toBe(dueTerm);

  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(answerInput).toBeVisible();
  await expect(answerInput).toBeFocused();

  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View words' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'New collection' })).toBeVisible();
  await page.getByRole('button', { name: 'New collection' }).click();
  const collectionTitle = `Angular E2E Collection ${Date.now()}`;
  await page.getByLabel('Title').fill(collectionTitle);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: collectionTitle })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.goto('/leitner-house/1');
  await expect(page.getByRole('heading', { name: 'House 1 words' })).toBeVisible();
  await expect(page.getByLabel('Search words')).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByLabel('New words per day').fill('12');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();

  await page.getByRole('button', { name: 'Create progress story' }).click();
  await expect(page.getByRole('heading', { name: 'Story Studio' })).toBeVisible();
  await expect(page.locator('canvas[width="1080"][height="1920"]')).toBeVisible();
  await expect(page.getByText(/email, typed answers/i)).toBeVisible();
});

test('wrong spelling shows highlights without a hint and Enter continues to recall', async ({ page }) => {
  await authenticate(page, `e2e-spelling-${Date.now()}@example.com`);
  const term = await firstDueTerm(page);
  const wrong = `${term.slice(0, -1)}${term.endsWith('x') ? 'y' : 'x'}`;

  await page.goto('/review');
  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByLabel('Your answer').fill(wrong);
  await page.getByRole('button', { name: 'Check answer' }).click();

  await expect(page.getByRole('heading', { name: 'Spelling correction' })).toBeVisible();
  const userSpelling = page.getByTestId('user-spelling');
  const correctSpelling = page.getByTestId('correct-spelling');
  await expect(userSpelling).toContainText(wrong.toLocaleLowerCase('en'));
  await expect(correctSpelling).toContainText(term.toLocaleLowerCase('en'));
  await expect(userSpelling.locator('.spelling-changed, .spelling-extra')).toHaveCount(1);
  await expect(correctSpelling.locator('.spelling-changed, .spelling-missing')).toHaveCount(1);
  await expect(userSpelling.locator('.spelling-correct').first()).toBeVisible();
  await expect(correctSpelling.locator('.spelling-correct').first()).toBeVisible();
  await expect(page.locator('.spelling-hint')).toHaveCount(0);

  await page.keyboard.press('Enter');
  const recallInput = page.getByLabel('Recall from memory');
  await expect(recallInput).toBeVisible();
  await expect(recallInput).toBeFocused();
});

test('review stays shell-free and viewport-fitted on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page, `e2e-review-mobile-${Date.now()}@example.com`);
  await firstDueTerm(page);

  await page.goto('/review');
  const layout = page.getByTestId('review-layout');
  await expect(layout).toBeVisible();
  await expect(page.locator('app-shell')).toHaveCount(0);
  await expect(page.locator('.sidebar, .topbar, .mobile-nav')).toHaveCount(0);

  const box = await layout.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBe(0);
  expect(box!.width).toBeGreaterThan(360);
  expect(box!.width).toBeLessThanOrEqual(390);

  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByTestId('review-session-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit review' })).toBeVisible();
  await expect(page.getByLabel('Your answer')).toBeVisible();
});
