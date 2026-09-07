import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce' });

const pathId = 'path-1';
const lessonId = 'lesson-1';
const exerciseId = 'intake-1';
const contextPath = `/api/learning-paths/${pathId}/lessons/${lessonId}/exercises/${exerciseId}`;

function context(state: 'available' | 'in_progress' | 'completed', newCount: number) {
  return {
    context: {
      path: { id: pathId, collectionId: 'course-1', title: 'BBC course', mode: 'rolling', contentVersion: 1 },
      lesson: { id: lessonId, title: 'Episode lesson', position: 1 },
      exercise: {
        id: exerciseId,
        position: 1,
        type: 'vocabulary.intake',
        schemaVersion: 1,
        required: true,
        completionPolicy: 'vocabulary-intake',
        config: { scope: { kind: 'listening-episode', ref: 'episode-1' } },
      },
      progress: state === 'available' ? null : {
        status: state === 'completed' ? 'completed' : 'in_progress',
        startedAt: '2026-09-06T18:00:00.000Z',
        completedAt: state === 'completed' ? '2026-09-06T18:01:00.000Z' : null,
        lastActivityAt: '2026-09-06T18:01:00.000Z',
      },
      state,
      payload: {
        scope: { kind: 'listening-episode', ref: 'episode-1' },
        items: [
          {
            id: 'new-1', term: 'persistent', definitions: ['continuing for a long time'],
            examples: ['She made a persistent effort.'],
            progress: { state: newCount > 0 ? 'new' : 'learning', box: newCount > 0 ? 0 : 1 },
          },
          { id: 'learning-1', term: 'establish', definitions: [], examples: [], progress: { state: 'learning', box: 3 } },
          { id: 'mastered-1', term: 'mastered', definitions: [], examples: [], progress: { state: 'mastered', box: 5 } },
          { id: 'excluded-1', term: 'excluded', definitions: [], examples: [], progress: { state: 'excluded', box: 0 } },
        ],
        summary: { total: 4, newCount, learningCount: newCount > 0 ? 1 : 2, masteredCount: 1, excludedCount: 1 },
      },
    },
  };
}

function canonicalStateAfterActivation() {
  const timestamp = '2026-09-06T18:00:00.000Z';
  return {
    revision: 3,
    state: {
      schemaVersion: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
      settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: 'system' },
      words: [
        {
          id: 'new-1',
          number: 1,
          term: 'persistent',
          accepted: ['persistent'],
          category: 'Uncategorized',
          tags: [],
          lessons: [],
          notes: '',
          createdAt: timestamp,
          box: 1,
          due: '2026-09-06',
          attempts: 0,
          correct: 0,
          mistakes: 0,
          currentStreak: 0,
          introducedOn: '2026-09-06',
          addedSource: 'learning-path',
          lastReviewed: null,
          lastPromotedDay: null,
          blockedUntil: null,
          masteredAt: null,
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
      summary: { total: 4, newCount: 0, learningCount: 2, masteredCount: 1, excludedCount: 1 },
    } });
  });
  await page.route(`**${contextPath}/complete`, async (route) => {
    commands.push({ path: contextPath + '/complete', body: route.request().postDataJSON() ?? null });
    state = 'completed';
    await route.fulfill({ json: {
      pathId, lessonId, exerciseId, exerciseStatus: 'completed', lessonStatus: 'completed',
      pathStatus: 'up_to_date', resumePoint: null,
    } });
  });
  return commands;
}

test('vocabulary intake activates only new scoped words and completes through server authority', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const commands = await mockIntake(page);

  await page.goto(`/learning-path/${pathId}/lessons/${lessonId}/exercises/${exerciseId}`);

  await expect(page.getByTestId('vocabulary-intake')).toBeVisible();
  await expect(page.getByText('Box 3')).toBeVisible();
  await expect(page.getByText('Mastered', { exact: true })).toBeVisible();
  await expect(page.getByText('Excluded', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add 1 new word' }).click();

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
