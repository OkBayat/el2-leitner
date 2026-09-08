import { expect, test, type Page } from '@playwright/test';
import { createFreshState } from '../src/app/domain/learning/learning-rules';

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce' });

const collectionId = 'bbc-six-minute-english';
const pathId = '1';
const episodeOne = '1';
const episodeTwo = '2';
const intakeOne = '1';
const intakeTwo = '2';

function exercise(id: string, state: 'available' | 'in_progress' | 'completed') {
  return {
    id,
    position: 10,
    type: 'vocabulary.intake',
    schemaVersion: 1,
    required: true,
    completionPolicy: 'vocabulary-intake',
    config: { scope: { kind: 'listening-episode', ref: id.includes(episodeTwo) ? episodeTwo : episodeOne } },
    state,
    progress: state === 'available' ? null : {
      status: state,
      startedAt: '2026-09-06T20:00:00.000Z',
      completedAt: state === 'completed' ? '2026-09-06T20:01:00.000Z' : null,
      lastActivityAt: '2026-09-06T20:01:00.000Z',
    },
  };
}

function lesson(id: string, position: number, exerciseId: string, state: 'available' | 'in_progress' | 'completed') {
  return {
    id,
    title: `BBC episode ${position}`,
    position,
    sourceKind: 'listening-episode',
    sourceRef: id,
    state,
    progress: state === 'available' ? null : {
      status: state,
      startedAt: '2026-09-06T20:00:00.000Z',
      completedAt: state === 'completed' ? '2026-09-06T20:01:00.000Z' : null,
      lastActivityAt: '2026-09-06T20:01:00.000Z',
    },
    exercises: [exercise(exerciseId, state)],
  };
}

function pathView(input: {
  canProgress: boolean;
  learnerStatus: 'available' | 'in_progress' | 'up_to_date';
  contentVersion: string;
  resumePoint: { lessonId: string; exerciseId: string } | null;
  lessons: ReturnType<typeof lesson>[];
}) {
  return {
    access: { canProgress: input.canProgress },
    resumePoint: input.resumePoint,
    path: {
      id: pathId,
      collectionId,
      title: 'BBC 6 Minute English',
      mode: 'rolling',
      status: 'published',
      contentVersion: input.contentVersion,
      learnerStatus: input.learnerStatus,
      progress: null,
    },
    lessons: input.lessons,
  };
}

function intakeContext(lessonId: string, exerciseId: string, state: 'available' | 'in_progress') {
  return {
    context: {
      path: { id: pathId, collectionId, title: 'BBC 6 Minute English', mode: 'rolling', contentVersion: '2' },
      lesson: { id: lessonId, title: lessonId === episodeTwo ? 'BBC episode 2' : 'BBC episode 1', position: lessonId === episodeTwo ? 2 : 1 },
      exercise: {
        id: exerciseId,
        position: 10,
        type: 'vocabulary.intake',
        schemaVersion: 1,
        required: true,
        completionPolicy: 'vocabulary-intake',
        config: { scope: { kind: 'listening-episode', ref: lessonId } },
      },
      progress: state === 'available' ? null : {
        status: 'in_progress',
        startedAt: '2026-09-06T20:02:00.000Z',
        completedAt: null,
        lastActivityAt: '2026-09-06T20:02:00.000Z',
      },
      state,
      payload: {
        scope: { kind: 'listening-episode', ref: lessonId },
        items: [],
        summary: { total: 0, newCount: 0, learningCount: 0, masteredCount: 0, excludedCount: 0 },
      },
    },
  };
}

async function mockShell(page: Page) {
  const state = createFreshState([]);
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'learner-1', email: 'learner@example.test' } } }));
  await page.route('**/api/state**', (route) => route.fulfill({ json: { state, revision: 1 } }));
}

test('Library Start course enrolls and opens the server-authoritative BBC resume exercise', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockShell(page);
  const writes: string[] = [];
  let subscribed = false;
  let exerciseState: 'available' | 'in_progress' = 'available';
  let currentView = pathView({
    canProgress: false,
    learnerStatus: 'available',
    contentVersion: '1',
    resumePoint: { lessonId: episodeOne, exerciseId: intakeOne },
    lessons: [lesson(episodeOne, 1, intakeOne, 'available')],
  });

  await page.route('**/api/library', (route) => route.fulfill({ json: {
    collections: [{
      id: collectionId,
      slug: collectionId,
      title: 'BBC 6 Minute English',
      description: 'Rolling listening course',
      kind: 'course',
      visibility: 'public',
      status: 'published',
      contentVersion: 1,
      wordCount: 0,
      subscribed,
    }],
  } }));
  await page.route(`**/api/library/${collectionId}`, (route) => route.fulfill({ json: {
    collection: {
      id: collectionId,
      slug: collectionId,
      title: 'BBC 6 Minute English',
      description: 'Rolling listening course',
      kind: 'course',
      visibility: 'public',
      status: 'published',
      contentVersion: 1,
      wordCount: 0,
      subscribed,
      entries: [],
    },
    capabilities: {canManage: false},
  } }));
  await page.route(`**/api/library/${collectionId}/subscription`, async (route) => {
    writes.push('subscribe');
    subscribed = true;
    currentView = { ...currentView, access: { canProgress: true } };
    await route.fulfill({ json: { collection: { id: collectionId, subscribed: true } } });
  });
  await page.route(`**/api/learning-paths/collections/${collectionId}`, (route) => route.fulfill({ json: currentView }));
  await page.route(`**/api/learning-paths/${pathId}/start`, async (route) => {
    writes.push('start-path');
    currentView = { ...currentView, path: { ...currentView.path, learnerStatus: 'in_progress' } };
    await route.fulfill({ json: { pathId, pathStatus: 'in_progress', resumePoint: currentView.resumePoint } });
  });
  const contextPath = `/api/learning-paths/${pathId}/lessons/${episodeOne}/exercises/${intakeOne}`;
  await page.route(`**${contextPath}`, (route) => route.fulfill({ json: intakeContext(episodeOne, intakeOne, exerciseState) }));
  await page.route(`**${contextPath}/start`, async (route) => {
    writes.push('start-exercise');
    exerciseState = 'in_progress';
    await route.fulfill({ json: { pathId, lessonId: episodeOne, exerciseId: intakeOne, exerciseStatus: 'in_progress' } });
  });

  await page.goto('/library');
  await expect(page.getByRole('heading', {name: 'All Courses'})).toBeVisible();
  const courseItem = page.getByTestId('library-all-courses').getByRole('button', {name: 'BBC 6 Minute English'});
  const lightBackground = await courseItem.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect((await courseItem.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect.poll(() => courseItem.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(lightBackground);
  await courseItem.focus();
  await expect.poll(() => courseItem.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  await courseItem.click();
  await expect(page.getByTestId('library-detail-page')).toBeVisible();
  await expect(page.getByTestId('leitner-only-action')).toContainText('Add to Leitner Only');
  await page.getByTestId('start-course-action').click();

  await expect(page).toHaveURL(new RegExp(`/learning-paths/${pathId}/lessons/${episodeOne}/exercises/${intakeOne}$`, 'u'));
  await expect(page.getByTestId('vocabulary-intake')).toBeVisible();
  await expect(page.getByRole('heading', { name: "Meet this lesson's words" })).toBeVisible();
  expect(writes).toEqual(['subscribe', 'start-path']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('rolling BBC course exposes a ready lesson trail node when a newly synchronized episode appears', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockShell(page);
  let exerciseState: 'available' | 'in_progress' = 'available';
  let currentView = pathView({
    canProgress: true,
    learnerStatus: 'up_to_date',
    contentVersion: '1',
    resumePoint: null,
    lessons: [lesson(episodeOne, 1, intakeOne, 'completed')],
  });

  await page.route(`**/api/learning-paths/collections/${collectionId}`, (route) => route.fulfill({ json: currentView }));
  await page.route(`**/api/learning-paths/${pathId}`, (route) => route.fulfill({ json: currentView }));
  const secondContextPath = `/api/learning-paths/${pathId}/lessons/${episodeTwo}/exercises/${intakeTwo}`;
  await page.route(`**${secondContextPath}`, (route) => route.fulfill({ json: intakeContext(episodeTwo, intakeTwo, exerciseState) }));
  await page.route(`**${secondContextPath}/start`, async (route) => {
    exerciseState = 'in_progress';
    await route.fulfill({ json: { pathId, lessonId: episodeTwo, exerciseId: intakeTwo, exerciseStatus: 'in_progress' } });
  });

  await page.goto(`/library/${collectionId}/learning-path`);
  await expect(page).toHaveURL(`/learning-paths/${pathId}`);
  const pathStatus = page.locator('.path-header__status');
  await expect(pathStatus).toHaveText('Up to date');
  await expect(page.getByRole('button', { name: 'Vocabulary intake, Completed, Practice again' })).toBeEnabled();
  await expect(page.getByText('BBC episode 1')).toBeVisible();

  currentView = pathView({
    canProgress: true,
    learnerStatus: 'in_progress',
    contentVersion: '2',
    resumePoint: { lessonId: episodeTwo, exerciseId: intakeTwo },
    lessons: [
      lesson(episodeOne, 1, intakeOne, 'completed'),
      lesson(episodeTwo, 2, intakeTwo, 'available'),
    ],
  });
  await page.reload();

  await expect(pathStatus).toHaveText('In progress');
  await expect(page.getByText('BBC episode 1')).toBeVisible();
  await expect(page.getByText('BBC episode 2')).toBeVisible();
  const readyNode = page.getByRole('button', { name: 'Vocabulary intake, Ready' });
  await expect(readyNode).toBeEnabled();
  await expect(readyNode.locator('.exercise-node__flag')).toHaveText('START');
  await readyNode.click();
  await expect(page).toHaveURL(new RegExp(`/learning-paths/${pathId}/lessons/${episodeTwo}/exercises/${intakeTwo}$`, 'u'));
});
