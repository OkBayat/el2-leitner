import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce' });

const pathId = 'cvfi-learning-path';
const lessonId = 'cvfi-unit-01';
const exerciseId = 'cvfi-u01-intake';
const contextPath = `/api/learning-paths/${pathId}/lessons/${lessonId}/exercises/${exerciseId}`;

function context(state: 'available' | 'in_progress' | 'completed', newCount: number) {
  return {
    context: {
      path: { id: pathId, collectionId: 'cambridge-vocabulary-for-ielts', title: 'Cambridge Vocabulary for IELTS', mode: 'finite', contentVersion: 1 },
      lesson: { id: lessonId, title: 'Unit 1 — Growing up', position: 1 },
      exercise: {
        id: exerciseId,
        position: 10,
        type: 'vocabulary.intake',
        schemaVersion: 1,
        required: true,
        completionPolicy: 'vocabulary-intake',
        config: { scope: { kind: 'lesson-source' } },
      },
      progress: state === 'available' ? null : {
        status: state === 'completed' ? 'completed' : 'in_progress',
        startedAt: '2026-09-07T10:00:00.000Z',
        completedAt: state === 'completed' ? '2026-09-07T10:03:00.000Z' : null,
        lastActivityAt: '2026-09-07T10:03:00.000Z',
      },
      state,
      payload: {
        scope: { kind: 'collection-section', ref: lessonId },
        items: [
          {
            id: 'new-1', term: 'persistent', definitions: ['continuing for a long time'], examples: [],
            progress: { state: newCount > 0 ? 'new' : 'learning', box: newCount > 0 ? 0 : 1 },
          },
          { id: 'box-1', term: 'establish', definitions: ['to create or set up'], examples: [], progress: { state: 'learning', box: 1 } },
          { id: 'box-2', term: 'vary', definitions: ['to be different'], examples: [], progress: { state: 'learning', box: 2 } },
          { id: 'mastered', term: 'mature', definitions: ['fully developed'], examples: [], progress: { state: 'mastered', box: 5 } },
          { id: 'excluded', term: 'omit', definitions: ['to leave out'], examples: [], progress: { state: 'excluded', box: 0 } },
        ],
        summary: { total: 5, newCount, learningCount: newCount > 0 ? 2 : 3, masteredCount: 1, excludedCount: 1 },
      },
    },
  };
}

function canonicalStateAfterActivation() {
  const timestamp = '2026-09-07T10:00:00.000Z';
  return {
    revision: 3,
    state: {
      schemaVersion: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
      settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: 'system' },
      words: [
        {
          id: 'new-1', number: 1, term: 'persistent', accepted: ['persistent'], category: 'Growing up', tags: [], lessons: ['Unit 1 — Growing up'], notes: '', createdAt: timestamp,
          box: 1, due: '2026-09-07', attempts: 0, correct: 0, mistakes: 0, currentStreak: 0,
          introducedOn: '2026-09-07', addedSource: 'learning-path', lastReviewed: null, lastPromotedDay: null,
          blockedUntil: null, masteredAt: null,
        },
      ],
      daily: {},
      history: [],
    },
  };
}

async function mockIntake(page: Page) {
  let state: 'available' | 'in_progress' | 'completed' = 'available';
  let newCount = 1;
  const commands: Array<{ path: string; body: unknown }> = [];

  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'learner-1', email: 'learner@example.test' } } }));
  await page.route(/\/api\/state\?view=bootstrap$/u, (route) => route.fulfill({ json: canonicalStateAfterActivation() }));
  await page.route(`**${contextPath}`, (route) => route.fulfill({ json: context(state, newCount) }));
  await page.route(`**${contextPath}/start`, async (route) => {
    state = 'in_progress';
    commands.push({ path: contextPath + '/start', body: route.request().postDataJSON() ?? null });
    await route.fulfill({ json: { pathId, lessonId, exerciseId, exerciseStatus: 'in_progress' } });
  });
  await page.route(`**${contextPath}/vocabulary-intake/activate`, async (route) => {
    newCount = 0;
    commands.push({ path: contextPath + '/vocabulary-intake/activate', body: route.request().postDataJSON() ?? null });
    await route.fulfill({ json: {
      pathId, lessonId, exerciseId, exerciseStatus: 'in_progress', activatedCount: 1, revision: 3,
      summary: { total: 5, newCount: 0, learningCount: 3, masteredCount: 1, excludedCount: 1 },
    } });
  });
  await page.route(`**${contextPath}/complete`, async (route) => {
    commands.push({ path: contextPath + '/complete', body: route.request().postDataJSON() ?? null });
    state = 'completed';
    await route.fulfill({ json: {
      pathId, lessonId, exerciseId, exerciseStatus: 'completed', lessonStatus: 'in_progress',
      pathStatus: 'in_progress', resumePoint: { lessonId, exerciseId: 'cvfi-u01-quick-review' }, progressRevision: 1,
    } });
  });
  await page.route(`**/api/learning-paths/${pathId}/resume`, (route) => route.fulfill({ json: {
    pathId, pathStatus: 'in_progress', resumePoint: { lessonId, exerciseId: 'cvfi-u01-quick-review' }, progressRevision: 1,
  } }));
  return commands;
}

test('Cambridge vocabulary intake runs as a slide quiz for new and Box 1 words', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const commands = await mockIntake(page);

  await page.goto(`/learning-path/${pathId}/lessons/${lessonId}/exercises/${exerciseId}`);

  await expect(page.getByTestId('vocabulary-intake')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByText('5 words · 1 mastered · 2 to practice')).toBeVisible();
  await page.getByRole('button', { name: "Let's Go" }).click();

  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'persistent' })).toBeVisible();
  await expect(page.getByText('Word 1 of 2')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled();
  await page.getByRole('radio', { name: 'continuing for a long time' }).click();
  await expect(page.getByRole('button', { name: 'Check' })).toBeEnabled();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Correct', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'establish' })).toBeVisible();
  await expect(page.getByText('Word 2 of 2')).toBeVisible();
  const options = page.getByRole('radio');
  const labels = await options.allTextContents();
  const wrongIndex = labels.findIndex((label) => !label.includes('to create or set up'));
  expect(wrongIndex).toBeGreaterThanOrEqual(0);
  await options.nth(wrongIndex).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Not quite', { exact: true })).toBeVisible();
  await expect(page.getByText('Correct answer: to create or set up')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  const summary = page.getByTestId('summary-slide-content');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Correct');
  await expect(summary).toContainText('Incorrect');
  await expect(summary).toContainText('1');
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(page.getByRole('heading', { name: 'Exercise completed' })).toBeVisible();
  expect(commands.map((command) => command.path)).toEqual([
    `${contextPath}/start`,
    `${contextPath}/vocabulary-intake/activate`,
    `${contextPath}/complete`,
  ]);
  expect(commands.at(-1)?.body).toEqual({
    outcome: { kind: 'completed' },
    progressRevision: 0,
  });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
