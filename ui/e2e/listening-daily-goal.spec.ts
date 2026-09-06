import { expect, test, type Page } from '@playwright/test';

const today = new Date().toISOString().slice(0, 10);

interface HomeListeningFixture {
  goal: number;
  completed: number;
  timelineGoal?: number;
}

async function mockListeningHome(page: Page, fixture: HomeListeningFixture) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }));
  await page.route('**/api/auth/me', route => route.fulfill({
    json: { user: { id: 'listening-goal', email: 'listening-goal@example.test' } },
  }));
  await page.route('**/api/state**', route => route.fulfill({
    json: {
      revision: 7,
      state: {
        schemaVersion: 2,
        createdAt: `${today}T00:00:00Z`,
        updatedAt: `${today}T00:00:00Z`,
        settings: {
          dailyNew: 0,
          dailyGoal: 20,
          dailyListeningGoal: fixture.goal,
          voiceRate: 0.85,
          theme: 'light',
        },
        words: [],
        daily: {},
        history: [],
      },
    },
  }));
  await page.route('**/api/learning/timeline?**', route => route.fulfill({
    json: {
      today,
      nextBefore: null,
      limitedHistory: false,
      days: [{
        day: today,
        activities: fixture.completed > 0 ? ['listening'] : [],
        boxOnePracticed: false,
        listeningProgress: {
          completed: fixture.completed,
          total: fixture.timelineGoal ?? fixture.goal,
        },
      }],
    },
  }));
}

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce' });

test('Home always shows the default three-part Listening ring and practice 1 of 3', async ({ page }) => {
  await mockListeningHome(page, { goal: 3, completed: 0 });
  await page.goto('/dashboard');

  const listening = page.getByTestId('home-listening');
  await expect(listening.locator('.node-progress-segment')).toHaveCount(3);
  await expect(listening.locator('.node-progress-segment.is-complete')).toHaveCount(0);
  await expect(listening).toHaveAttribute('data-listening-completed', '0');
  await expect(listening).toHaveAttribute('data-listening-goal', '3');

  await listening.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Start practice 1 of 3');
  await expect(dialog.getByRole('link', { name: 'Start', exact: true })).toBeVisible();
});

test('the saved setting controls the segment count immediately, even if the timeline carries an older goal', async ({ page }) => {
  await mockListeningHome(page, { goal: 4, completed: 1, timelineGoal: 3 });
  await page.goto('/dashboard');

  const listening = page.getByTestId('home-listening');
  await expect(listening.locator('.node-progress-segment')).toHaveCount(4);
  await expect(listening.locator('.node-progress-segment.is-complete')).toHaveCount(1);
  await expect(listening).toHaveAttribute('data-listening-completed', '1');
  await expect(listening).toHaveAttribute('data-listening-goal', '4');

  await listening.click();
  await expect(page.getByRole('dialog')).toContainText('Start practice 2 of 4');
});

test('after the daily goal the node becomes Legendary and an extra attempt adds one gold segment', async ({ page }) => {
  await mockListeningHome(page, { goal: 3, completed: 4 });
  await page.goto('/dashboard');

  const listening = page.getByTestId('home-listening');
  await expect(listening).toHaveClass(/is-legendary/u);
  await expect(listening.locator('.node-progress-segment')).toHaveCount(4);
  await expect(listening.locator('.node-progress-segment.is-complete')).toHaveCount(3);
  await expect(listening.locator('.node-progress-segment.is-legendary')).toHaveCount(1);

  await listening.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveClass(/is-legendary/u);
  await expect(dialog).toContainText('Legendary');
  await expect(dialog.getByRole('link', { name: 'Legendary practice', exact: true })).toBeVisible();
});

test('changing Listening practices per day in Settings persists it and Home immediately renders the new segment count', async ({ page }) => {
  let goal = 3;
  let revision = 11;
  let savedGoal: number | null = null;

  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }));
  await page.route('**/api/auth/me', route => route.fulfill({
    json: { user: { id: 'listening-setting-save', email: 'listening-setting-save@example.test' } },
  }));
  await page.route('**/api/state**', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { state?: { settings?: { dailyListeningGoal?: number } } };
      savedGoal = body.state?.settings?.dailyListeningGoal ?? null;
      goal = savedGoal ?? goal;
      revision += 1;
      return route.fulfill({ json: { revision } });
    }
    return route.fulfill({
      json: {
        revision,
        state: {
          schemaVersion: 2,
          createdAt: `${today}T00:00:00Z`,
          updatedAt: `${today}T00:00:00Z`,
          settings: { dailyNew: 10, dailyGoal: 20, dailyListeningGoal: goal, voiceRate: 0.85, theme: 'light' },
          words: [],
          daily: {},
          history: [],
        },
      },
    });
  });
  await page.route('**/api/learning/timeline?**', route => route.fulfill({
    json: {
      today,
      nextBefore: null,
      limitedHistory: false,
      days: [{
        day: today,
        activities: [],
        boxOnePracticed: false,
        // Deliberately stale to prove Home uses the just-saved learner setting.
        listeningProgress: { completed: 0, total: 3 },
      }],
    },
  }));

  await page.goto('/settings');
  const input = page.getByLabel('Listening practices per day');
  await expect(input).toHaveValue('3');
  await input.fill('4');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(() => savedGoal).toBe(4);

  await page.goto('/dashboard');
  const listening = page.getByTestId('home-listening');
  await expect(listening).toHaveAttribute('data-listening-goal', '4');
  await expect(listening.locator('.node-progress-segment')).toHaveCount(4);
});
