import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'e2e-admin@example.com';
const ADMIN_PASSWORD = 'password123';

async function authenticateAdmin(page: Page): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  const registered = await page.waitForURL(/\/dashboard$/u, { timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
  if (!registered) {
    await expect(page.getByRole('alert')).toContainText('already registered');
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in to Vocora' }).click();
  }
  await expect(page).toHaveURL(/\/dashboard$/u);
}

test('English LTR Angular app preserves the complete learner and library flow', async ({ page }) => {
  await authenticateAdmin(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByText('Vocora', { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Today's plan")).toBeVisible();

  await page.goto('/words');
  await expect(page.getByRole('heading', { name: 'Word Bank' })).toBeVisible();
  await page.getByLabel('Search').fill('Monday');
  await expect(page.getByText('Monday', { exact: true })).toBeVisible();

  const firstDueTerm = await page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    const payload = await response.json();
    const today = new Date().toLocaleDateString('en-CA');
    const due = payload.state.words
      .filter((word: any) => word.box > 0 && !word.masteredAt && word.due && word.due <= today && (!word.blockedUntil || word.blockedUntil <= today))
      .sort((a: any, b: any) => String(a.due).localeCompare(String(b.due)) || b.mistakes - a.mistakes || a.number - b.number);
    return due[0]?.term as string | undefined;
  });
  expect(firstDueTerm).toBeTruthy();

  await page.goto('/review');
  await page.getByRole('button', { name: 'Start session' }).click();
  const answerInput = page.getByLabel('Your answer');
  await expect(answerInput).toBeVisible();
  await expect(answerInput).toBeFocused();
  await answerInput.fill(firstDueTerm!);
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();

  const savedReview = await page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    const payload = await response.json();
    return payload.state.history.at(-1);
  });
  expect(savedReview.correct).toBe(true);
  expect(savedReview.term).toBe(firstDueTerm);

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