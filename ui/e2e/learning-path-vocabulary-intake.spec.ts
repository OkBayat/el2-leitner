import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce' });

const pathId = '1';
const lessonId = '1';
const exerciseId = '1';
const contextPath = `/api/learning-paths/${pathId}/lessons/${lessonId}/exercises/${exerciseId}`;

function context(state: 'available' | 'in_progress' | 'completed', newCount: number) {
  return {
    context: {
      path: { id: pathId, collectionId: 'cambridge-vocabulary-for-ielts-intermediate', title: 'Cambridge Vocabulary for IELTS', mode: 'finite', contentVersion: 1 },
      lesson: { id: lessonId, title: 'Unit 1 — Growing up', position: 1 },
      exercise: {
        id: exerciseId,
        position: 10,
        type: 'vocabulary.intake',
        schemaVersion: 1,
        required: true,
        completionPolicy: 'vocabulary-intake',
        config: { scope: { kind: 'lesson-source' }, presentation: 'slides' },
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
      pathStatus: 'in_progress', resumePoint: { lessonId, exerciseId: '2' }, progressRevision: 1,
    } });
  });
  await page.route(`**/api/learning-paths/${pathId}/resume`, (route) => route.fulfill({ json: {
    pathId, pathStatus: 'in_progress', resumePoint: { lessonId, exerciseId: '2' }, progressRevision: 1,
  } }));
  return commands;
}

test('slide exercise desktop shell owns the viewport and constrains exercise chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockIntake(page);

  await page.goto(`/learning-paths/${pathId}/lessons/${lessonId}/exercises/${exerciseId}`);
  await expect(page.getByTestId('slide-exercise')).toBeVisible();
  await expect(page.getByTestId('message-slide-content')).toBeVisible();
  await expect(page.locator('.runner__topbar')).toHaveCount(0);

  const introLayout = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[data-testid="slide-exercise"]');
    const stage = document.querySelector<HTMLElement>('.slide-exercise__stage');
    const content = document.querySelector<HTMLElement>('[data-testid="message-slide-content"]');
    const footer = document.querySelector<HTMLElement>('[data-testid="slide-exercise-footer"]');
    const footerInner = document.querySelector<HTMLElement>('.slide-exercise-footer__inner');
    const action = document.querySelector<HTMLElement>('[data-testid="slide-exercise-footer"] button');
    if (!shell || !stage || !content || !footer || !footerInner || !action) throw new Error('Slide exercise layout is incomplete.');
    const shellRect = shell.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const footerInnerRect = footerInner.getBoundingClientRect();
    const actionRect = action.getBoundingClientRect();
    const footerInnerStyle = getComputedStyle(footerInner);
    return {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      shellTop: shellRect.top,
      shellHeight: shellRect.height,
      stageCenterY: stageRect.top + (stageRect.height / 2),
      contentCenterY: contentRect.top + (contentRect.height / 2),
      footerWidth: footerRect.width,
      footerBottom: footerRect.bottom,
      footerContentRight: footerInnerRect.right - Number.parseFloat(footerInnerStyle.paddingRight),
      actionRight: actionRect.right,
      documentHeight: document.documentElement.scrollHeight,
      windowScrollY: scrollY,
    };
  });

  expect(Math.abs(introLayout.shellTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(introLayout.shellHeight - introLayout.viewportHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(introLayout.footerBottom - introLayout.viewportHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(introLayout.footerWidth - introLayout.viewportWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(introLayout.contentCenterY - introLayout.stageCenterY)).toBeLessThanOrEqual(4);
  expect(Math.abs(introLayout.actionRight - introLayout.footerContentRight)).toBeLessThanOrEqual(2);
  expect(introLayout.documentHeight).toBeLessThanOrEqual(introLayout.viewportHeight + 1);
  expect(introLayout.windowScrollY).toBe(0);

  await page.getByRole('button', { name: "Let's Go" }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();

  const practiceChrome = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('[data-testid="slide-exercise-header"]');
    const progress = document.querySelector<HTMLElement>('[role="progressbar"]');
    const contentFrame = document.querySelector<HTMLElement>('.slide-exercise__content');
    if (!header || !progress || !contentFrame) throw new Error('Practice chrome is incomplete.');
    const headerRect = header.getBoundingClientRect();
    const progressRect = progress.getBoundingClientRect();
    const contentRect = contentFrame.getBoundingClientRect();
    return {
      viewportWidth: innerWidth,
      headerLeft: headerRect.left,
      headerRight: headerRect.right,
      headerWidth: headerRect.width,
      progressWidth: progressRect.width,
      contentLeft: contentRect.left,
      contentRight: contentRect.right,
    };
  });

  expect(practiceChrome.headerWidth).toBeLessThanOrEqual(981);
  expect(Math.abs(practiceChrome.headerLeft - practiceChrome.contentLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(practiceChrome.headerRight - practiceChrome.contentRight)).toBeLessThanOrEqual(1);
  expect(practiceChrome.progressWidth).toBeLessThan(practiceChrome.viewportWidth);
});

test('desktop slide stage scrolls with the mouse wheel while the footer stays visible', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 360 });
  await mockIntake(page);

  await page.goto(`/learning-paths/${pathId}/lessons/${lessonId}/exercises/${exerciseId}`);
  await page.getByRole('button', { name: "Let's Go" }).click();
  await expect(page.getByRole('heading', { name: 'persistent' })).toBeVisible();

  const stage = page.locator('.slide-exercise__stage');
  await expect.poll(() => stage.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await stage.hover();
  await page.mouse.wheel(0, 220);
  await expect.poll(() => stage.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const position = await page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>('[data-testid="slide-exercise-footer"]');
    if (!footer) throw new Error('Footer is missing.');
    return { footerBottom: footer.getBoundingClientRect().bottom, viewportHeight: innerHeight, windowScrollY: scrollY };
  });
  expect(Math.abs(position.footerBottom - position.viewportHeight)).toBeLessThanOrEqual(1);
  expect(position.windowScrollY).toBe(0);
});

test('Cambridge vocabulary intake runs as a slide quiz for new and Box 1 words', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const commands = await mockIntake(page);

  await page.goto(`/learning-paths/${pathId}/lessons/${lessonId}/exercises/${exerciseId}`);

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
