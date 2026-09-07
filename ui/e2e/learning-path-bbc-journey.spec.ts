import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce' });

const pathId = 'bbc-six-minute-english-learning-path';
const collectionId = 'bbc-six-minute-english';
const episodeOne = 'bbc-6-minute-english-260402';
const episodeTwo = 'bbc-6-minute-english-260409';
const intakeOne = 'bbc6-bbc-6-minute-english-260402-vocabulary-intake';

function pathView(options: { canProgress: boolean; learnerStatus: string; contentVersion?: string }) {
  return {
    path: { id: pathId, collectionId, title: 'BBC 6 Minute English', mode: 'rolling', contentVersion: options.contentVersion ?? '1', learnerStatus: options.learnerStatus },
    lessons: [
      {
        id: episodeOne, title: 'Are saunas good for you?', position: 20260402, state: 'available',
        exercises: [{ id: intakeOne, type: 'vocabulary.intake', position: 10, required: true, state: 'available' }],
      },
      {
        id: episodeTwo, title: 'Episode 2', position: 20260409, state: options.canProgress ? 'available' : 'locked', exercises: [],
      },
    ],
    resumePoint: { lessonId: episodeOne, exerciseId: intakeOne },
  };
}

function intakeContext(lessonId: string, exerciseId: string, state: 'available' | 'in_progress') {
  return {
    context: {
      path: { id: pathId, collectionId, title: 'BBC 6 Minute English', mode: 'rolling', contentVersion: 1 },
      lesson: { id: lessonId, title: 'Are saunas good for you?', position: 20260402 },
      exercise: {
        id: exerciseId, position: 10, type: 'vocabulary.intake', schemaVersion: 1, required: true,
        completionPolicy: 'vocabulary-intake', config: { scope: { kind: 'listening-episode', ref: lessonId } },
      },
      progress: state === 'available' ? null : { status: 'in_progress', startedAt: '2026-09-07T10:00:00.000Z', completedAt: null, lastActivityAt: '2026-09-07T10:00:00.000Z' },
      state,
      payload: {
        scope: { kind: 'listening-episode', ref: lessonId },
        items: [
          { id: 'sauna', term: 'sauna', definitions: ['a hot room used for relaxation'], examples: ['They relaxed in the sauna.'], progress: { state: 'new', box: 0 } },
        ],
        summary: { total: 1, newCount: 1, learningCount: 0, masteredCount: 0, excludedCount: 0 },
      },
    },
  };
}

async function mockShell(page: Page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'learner-1', email: 'learner@example.test' } } }));
  await page.route(/\/api\/state\?view=bootstrap$/u, (route) => route.fulfill({ json: { revision: 0, state: { schemaVersion: 2, settings: { dailyNew: 10, dailyGoal: 20, voiceRate: 0.85, theme: 'system' }, words: [], daily: {}, history: [] } } }));
}

test('Library Start course enrolls and opens the server-authoritative BBC resume exercise', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockShell(page);
  const writes: string[] = [];
  let exerciseState: 'available' | 'in_progress' = 'available';
  let currentView = pathView({ canProgress: false, learnerStatus: 'not_started' });

  await page.route('**/api/library?*', (route) => route.fulfill({ json: {
    items: [{ id: collectionId, title: 'BBC 6 Minute English', description: 'Short listening lessons', sourceType: 'podcast', itemCount: 23, tags: [], learningPath: { id: pathId, learnerStatus: currentView.path.learnerStatus, resumePoint: currentView.resumePoint } }],
  } }));
  await page.route(`**/api/collections/${collectionId}/learning-path`, (route) => route.fulfill({ json: currentView }));
  await page.route(`**/api/collections/${collectionId}/subscription`, async (route) => {
    if (route.request().method() === 'POST') {
      writes.push('subscribe');
      await route.fulfill({ json: { collectionId, subscribed: true } });
      return;
    }
    await route.fulfill({ json: { collectionId, subscribed: false } });
  });
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
  await expect(page.getByRole('heading', { name: 'BBC 6 Minute English' })).toBeVisible();
  await page.getByTestId('library-learning-path-action').click();

  await expect(page).toHaveURL(new RegExp(`/learning-path/${pathId}/lessons/${episodeOne}/exercises/${intakeOne}$`, 'u'));
  await expect(page.getByTestId('vocabulary-intake')).toBeVisible();
  await expect(page.getByRole('heading', { name: "Meet this lesson's words" })).toBeVisible();
  expect(writes).toEqual(['subscribe', 'start-path', 'start-exercise']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('rolling BBC course exposes a ready lesson trail node when a newly synchronized episode appears', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockShell(page);
  let exerciseState: 'available' | 'in_progress' = 'available';
  let currentView = pathView({
    canProgress: true,
    learnerStatus: 'up_to_date',
    contentVersion: '2',
  });

  await page.route('**/api/library?*', (route) => route.fulfill({ json: {
    items: [{ id: collectionId, title: 'BBC 6 Minute English', description: 'Short listening lessons', sourceType: 'podcast', itemCount: 24, tags: [], learningPath: { id: pathId, learnerStatus: currentView.path.learnerStatus, resumePoint: currentView.resumePoint } }],
  } }));
  await page.route(`**/api/collections/${collectionId}/learning-path`, (route) => route.fulfill({ json: currentView }));
  const contextPath = `/api/learning-paths/${pathId}/lessons/${episodeOne}/exercises/${intakeOne}`;
  await page.route(`**${contextPath}`, (route) => route.fulfill({ json: intakeContext(episodeOne, intakeOne, exerciseState) }));
  await page.route(`**${contextPath}/start`, async (route) => {
    exerciseState = 'in_progress';
    await route.fulfill({ json: { pathId, lessonId: episodeOne, exerciseId: intakeOne, exerciseStatus: 'in_progress' } });
  });

  await page.goto(`/library/${collectionId}/learning-path`);
  await expect(page.getByText('Episode 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Up to date')).toBeVisible();
});
