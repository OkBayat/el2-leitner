import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'password123';

async function authenticate(page: Page): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(`e2e-bbc-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="start-review"], [data-testid="practice-words"]')).toBeVisible({ timeout: 10_000 });
}

async function learningState(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    return response.json();
  });
}

test('BBC lessons expose three tests each, scroll-aware sticky audio, completion tracking, and isolated mistake capture', async ({ page }) => {
  await authenticate(page);

  await page.locator('.desktop-sidebar').getByRole('link', { name: 'BBC 6 Minute English' }).click();
  await expect(page).toHaveURL(/\/bbc-6-minute-english$/u);
  await expect(page.getByRole('heading', { name: 'BBC 6 Minute English' })).toBeVisible();

  const weatherLesson = page.getByTestId('bbc-lesson-climate-change-extreme-weather');
  const screenTimeLesson = page.getByTestId('bbc-lesson-limiting-screen-time-for-children');
  await expect(weatherLesson).toContainText('How is climate change affecting extreme weather?');
  await expect(weatherLesson).toContainText('3 IELTS-style tests · 30 questions in total');
  await expect(screenTimeLesson).toContainText('Limiting screen time for children');
  await expect(screenTimeLesson).toContainText('3 IELTS-style tests · 30 questions in total');
  const compactWeatherTest = weatherLesson.getByTestId('start-bbc-test-1');
  await expect(compactWeatherTest).toHaveAttribute(
    'aria-label',
    'Extreme weather: changing storms and their impacts — Medium — Start',
  );
  await expect(compactWeatherTest).toContainText('Medium');
  await expect(compactWeatherTest).toContainText('Start');

  for (const lesson of [weatherLesson, screenTimeLesson]) {
    for (const testId of ['test-1', 'test-2', 'test-3']) {
      await expect(lesson.getByTestId(`start-bbc-${testId}`)).toContainText('Start');
    }
  }

  const startResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && response.url().includes('/api/listening/bbc/lessons/climate-change-extreme-weather/tests/test-1/attempts')
    && response.status() === 201
  );
  await weatherLesson.getByTestId('start-bbc-test-1').click();
  await startResponsePromise;

  await expect(page).toHaveURL(/\/bbc-6-minute-english\/climate-change-extreme-weather\/tests\/test-1\/practice$/u);
  await expect(page.getByTestId('bbc-listening-practice-page')).toBeVisible();
  await expect(page.getByText('IELTS Listening Practice · Extreme weather: changing storms and their impacts')).toBeVisible();
  await expect(page.locator('app-shell')).toHaveCount(0);
  await expect(page.locator('.topbar, .product-tabs, .mobile-nav')).toHaveCount(0);

  const stickyPlayer = page.getByTestId('sticky-listening-audio-player');
  const audioPlayer = page.getByTestId('listening-audio-player');
  const collapsedProgress = page.getByTestId('audio-collapsed-progress');
  await expect(stickyPlayer).toBeVisible();
  await expect(audioPlayer).toBeVisible();
  await expect(page.getByTestId('audio-play')).toBeVisible();
  await expect(page.getByTestId('audio-stop')).toBeVisible();
  await expect(page.getByTestId('audio-back-5')).toBeVisible();
  await expect(page.getByTestId('audio-forward-5')).toBeVisible();
  await expect(page.getByTestId('audio-progress')).toBeVisible();
  await expect(collapsedProgress).toBeAttached();
  await expect(page.getByTestId('audio-question-progress')).toHaveCount(0);
  await expect(page.getByText('Now around:', { exact: false })).toHaveCount(0);
  expect(await stickyPlayer.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');

  const audio = page.locator('audio');
  await expect(audio).toHaveAttribute('src', '/api/listening/bbc/lessons/climate-change-extreme-weather/audio');
  await expect(audio).not.toHaveAttribute('autoplay', /.*/u);

  await expect(page.locator('[data-testid^="listening-question-"]')).toHaveCount(10);
  await expect(page.getByTestId('listening-question-6')).toContainText('landslide and mudslide');
  await expect(page.getByTestId('listening-question-7')).toContainText('storm surge');
  await expect(page.getByTestId('listening-question-8')).toContainText('sea levels');

  await page.getByTestId('listening-question-10').scrollIntoViewIfNeeded();
  await expect(audioPlayer).toHaveClass(/is-collapsed/u);
  await expect(collapsedProgress).toBeVisible();
  const stickyBox = await stickyPlayer.boundingBox();
  expect(stickyBox).not.toBeNull();
  expect(stickyBox!.y).toBeLessThanOrEqual(16);

  const collapsedProgressBox = await collapsedProgress.boundingBox();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(collapsedProgressBox).not.toBeNull();
  expect(collapsedProgressBox!.x).toBeLessThanOrEqual(1);
  expect(collapsedProgressBox!.y).toBeLessThanOrEqual(1);
  expect(collapsedProgressBox!.width).toBeGreaterThanOrEqual(viewportWidth - 2);

  await page.evaluate(() => window.scrollBy(0, -500));
  await expect(audioPlayer).not.toHaveClass(/is-collapsed/u);
  await expect(page.getByTestId('audio-play')).toBeVisible();

  await expect(page.getByTestId('submit-listening-attempt')).toBeEnabled();
  await expect(page.getByText('0 / 10 answered')).toBeVisible();
  await expect(page.getByText('Unanswered questions will be marked incorrect.')).toBeVisible();
  await expect(page.getByText('Correct answer:', { exact: false })).toHaveCount(0);

  const textAnswers: Record<number, string> = {
    1: 'weather',
    2: 'long term',
    3: 'waters',
    7: 'coast',
    8: 'rising',
    9: '10 metres',
  };
  for (const [number, answer] of Object.entries(textAnswers)) {
    await page.getByTestId(`listening-answer-${number}`).fill(answer);
  }
  await page.getByTestId('listening-option-4-A').getByRole('radio').check();
  await page.getByTestId('listening-option-5-A').getByRole('radio').check();
  await page.getByTestId('listening-option-6-B').getByRole('radio').check();

  await expect(page.getByText('9 / 10 answered')).toBeVisible();
  const stateBeforeSubmit = await learningState(page);
  const submitResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && /\/api\/listening\/bbc\/attempts\/[^/]+\/submit$/u.test(new URL(response.url()).pathname)
    && response.status() === 200
  );
  await page.getByTestId('submit-listening-attempt').click();
  const submitResponse = await submitResponsePromise;
  expect(new URL(submitResponse.url()).pathname).toMatch(/\/api\/listening\/bbc\/attempts\/[^/]+\/submit$/u);

  const score = page.getByTestId('listening-score');
  await expect(score).toContainText('7 / 10');
  await expect(score).toContainText('70%');
  await expect(page.getByTestId('listening-question-5')).toHaveClass(/incorrect/u);
  await expect(page.getByTestId('listening-question-7')).toHaveClass(/incorrect/u);
  await expect(page.getByTestId('listening-question-7')).toContainText('Correct answer: inland');
  await expect(page.getByTestId('listening-question-9')).not.toHaveClass(/incorrect/u);
  await expect(page.getByTestId('listening-question-10')).toContainText('Your answer: No answer');
  await expect(page.getByTestId('add-listening-word-7')).toBeVisible();
  await expect(page.getByTestId('add-listening-word-9')).toHaveCount(0);

  const stateAfterSubmit = await learningState(page);
  expect(stateAfterSubmit).toEqual(stateBeforeSubmit);

  const savePromise = page.waitForResponse((response) =>
    response.request().method() === 'PUT'
    && new URL(response.url()).pathname === '/api/state'
    && response.status() === 200
  );
  await page.getByTestId('add-listening-word-7').click();
  await savePromise;
  await expect(page.getByTestId('add-listening-word-7')).toHaveCount(0);
  await expect(page.getByTestId('listening-word-in-house-1-7')).toContainText('Already in House 1');

  const stateAfterCapture = await learningState(page);
  const inland = stateAfterCapture.state.words.find((word: any) =>
    String(word.term).toLowerCase() === 'inland'
    || word.accepted?.some((accepted: string) => accepted.toLowerCase() === 'inland')
  );
  expect(inland).toBeTruthy();
  expect(inland.box).toBe(1);
  expect(inland.addedSource).toBe('listening-mistake');

  const catalogResponse = page.waitForResponse((response) =>
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/listening/bbc/lessons'
    && response.status() === 200
  );
  await page.getByRole('link', { name: 'Back to tests' }).click();
  await catalogResponse;
  await expect(page).toHaveURL(/\/bbc-6-minute-english$/u);

  const weatherLessonAfter = page.getByTestId('bbc-lesson-climate-change-extreme-weather');
  const screenTimeLessonAfter = page.getByTestId('bbc-lesson-limiting-screen-time-for-children');
  await expect(weatherLessonAfter.getByTestId('start-bbc-test-1')).toContainText('✓ Completed');
  await expect(weatherLessonAfter.getByTestId('start-bbc-test-2')).toContainText('Start');
  await expect(weatherLessonAfter.getByTestId('start-bbc-test-3')).toContainText('Start');
  await expect(screenTimeLessonAfter.getByTestId('start-bbc-test-1')).toContainText('Start');
  await expect(screenTimeLessonAfter.getByTestId('start-bbc-test-2')).toContainText('Start');
  await expect(screenTimeLessonAfter.getByTestId('start-bbc-test-3')).toContainText('Start');
});
