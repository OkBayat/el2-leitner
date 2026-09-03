import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'password123';

async function authenticate(page: Page): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(`e2e-bbc-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  await expect(page.getByTestId('open-bbc-listening')).toBeVisible({ timeout: 10_000 });
}

async function learningState(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    return response.json();
  });
}

test('BBC listening keeps IELTS grading isolated until the learner explicitly adds a non-numeric mistake to House 1', async ({ page }) => {
  await authenticate(page);
  const stateBefore = await learningState(page);

  await page.getByTestId('open-bbc-listening').click();
  await expect(page).toHaveURL(/\/bbc-6-minute-english$/u);
  await expect(page.getByRole('heading', { name: 'BBC 6 Minute English' })).toBeVisible();
  await expect(page.getByText('How is climate change affecting extreme weather?')).toBeVisible();
  await expect(page.getByText('13 IELTS-style questions')).toBeVisible();

  const startResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && response.url().includes('/api/listening/bbc/lessons/climate-change-extreme-weather/attempts')
    && response.status() === 201
  );
  await page.getByTestId('start-bbc-lesson').click();
  await startResponsePromise;

  await expect(page).toHaveURL(/\/bbc-6-minute-english\/climate-change-extreme-weather\/practice$/u);
  await expect(page.getByTestId('bbc-listening-practice-page')).toBeVisible();
  await expect(page.locator('app-shell')).toHaveCount(0);
  await expect(page.locator('.topbar, .product-tabs, .mobile-nav')).toHaveCount(0);
  await expect(page.locator('[data-testid^="listening-question-"]')).toHaveCount(13);
  await expect(page.getByTestId('listening-question-8')).toContainText('landslides and mudslides');
  await expect(page.getByTestId('listening-question-9')).toContainText('swept');
  await expect(page.getByTestId('listening-question-10')).toContainText('sea');
  await expect(page.getByTestId('submit-listening-attempt')).toBeEnabled();
  await expect(page.getByText('0 / 13 answered')).toBeVisible();
  await expect(page.getByText('Unanswered questions will be marked incorrect.')).toBeVisible();
  await expect(page.getByText('Correct answer:', { exact: false })).toHaveCount(0);

  const textAnswers: Record<number, string> = {
    1: 'day',
    2: 'long term',
    3: 'typhoons',
    4: 'tropical',
    5: 'slowly',
    9: 'inland',
    10: 'coast',
    11: '10 metres',
    12: '2C',
  };
  for (const [number, answer] of Object.entries(textAnswers)) {
    await page.getByTestId(`listening-answer-${number}`).fill(answer);
  }
  await page.getByTestId('listening-option-6-A').getByRole('radio').check();
  await page.getByTestId('listening-option-7-A').getByRole('radio').check();
  await page.getByTestId('listening-option-8-A').getByRole('radio').check();

  await expect(page.getByText('12 / 13 answered')).toBeVisible();
  const submitResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && /\/api\/listening\/bbc\/attempts\/[^/]+\/submit$/u.test(new URL(response.url()).pathname)
    && response.status() === 200
  );
  await page.getByTestId('submit-listening-attempt').click();
  const submitPayload = await (await submitResponsePromise).json();
  expect(submitPayload.score).toEqual({ correct: 9, wrong: 4, total: 13, percentage: 69.2 });

  const score = page.getByTestId('listening-score');
  await expect(score).toContainText('9 / 13');
  await expect(score).toContainText('69.2%');
  await expect(page.getByTestId('listening-question-6')).toHaveClass(/incorrect/u);
  await expect(page.getByTestId('listening-question-10')).toHaveClass(/incorrect/u);
  await expect(page.getByTestId('listening-question-10')).toContainText('Correct answer: sea levels');
  await expect(page.getByTestId('listening-question-12')).toContainText('Correct answer: around 1C');
  await expect(page.getByTestId('listening-question-13')).toContainText('Your answer: No answer');

  await expect(page.getByTestId('add-listening-word-6')).toBeVisible();
  await expect(page.getByTestId('add-listening-word-10')).toBeVisible();
  await expect(page.getByTestId('add-listening-word-12')).toHaveCount(0);
  await expect(page.getByTestId('add-listening-word-13')).toBeVisible();

  const stateAfterSubmit = await learningState(page);
  expect(stateAfterSubmit).toEqual(stateBefore);

  const savePromise = page.waitForResponse((response) =>
    response.request().method() === 'PUT'
    && new URL(response.url()).pathname === '/api/state'
    && response.status() === 200
  );
  await page.getByTestId('add-listening-word-10').click();
  await savePromise;
  await expect(page.getByTestId('add-listening-word-10')).toContainText('Added to House 1');
  await expect(page.getByTestId('add-listening-word-10')).toBeDisabled();

  const stateAfterCapture = await learningState(page);
  const seaLevels = stateAfterCapture.state.words.find((word: any) =>
    String(word.term).toLowerCase() === 'sea levels'
    || word.accepted?.some((accepted: string) => accepted.toLowerCase() === 'sea levels')
  );
  expect(seaLevels).toBeTruthy();
  expect(seaLevels.box).toBe(1);
  expect(seaLevels.addedSource).toBe('listening-mistake');
});
