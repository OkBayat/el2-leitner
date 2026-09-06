import { expect, test, type Page, type Locator } from '@playwright/test';
import type { PathActivity, TimelinePage } from '../src/app/domain/home/daily-path';

test.use({ timezoneId: 'UTC', reducedMotion: 'reduce' });
const today = new Date().toISOString().slice(0, 10);
const shift = (offset: number) => new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const emptyState = {
  schemaVersion: 2, createdAt: `${today}T00:00:00Z`, updatedAt: `${today}T00:00:00Z`,
  settings: { dailyNew: 0, dailyGoal: 20, voiceRate: .85, theme: 'light' }, words: [], daily: {}, history: [],
};

async function mockHome(page: Page) {
  const control = {
    fail: false, olderGate: Promise.resolve(), requests: [] as string[], writes: [] as string[],
    activities: ['vocabulary'] as PathActivity[],
  };
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') control.writes.push(request.url());
  });
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'home-layout', email: 'layout@example.test' } } }));
  await page.route('**/api/state**', route => route.fulfill({ json: { state: emptyState, revision: 1 } }));
  await page.route('**/api/learning/timeline?**', async route => {
    const before = new URL(route.request().url()).searchParams.get('before');
    control.requests.push(before ?? 'latest');
    if (before) await control.olderGate;
    if (control.fail) return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Try again' } } });
    const offsets = before ? [-13, -12, -11, -10, -9, -8, -7] : [-6, -5, -4, -3, -2, -1, 0];
    const response: TimelinePage = {
      today, nextBefore: before ? null : shift(-6), limitedHistory: false,
      days: offsets.map(offset => ({
        day: shift(offset), boxOnePracticed: offset === -1,
        activities: offset === 0 ? control.activities : offset === -1 ? ['vocabulary', 'listening', 'shadowing'] : before ? ['vocabulary'] : [],
      })),
    };
    await route.fulfill({ json: response });
  });
  return control;
}

async function expectFits(panel: Locator, page: Page) {
  const viewport = page.viewportSize()!;
  await expect.poll(async () => {
    const box = await panel.boundingBox();
    return box ? Math.min(box.x, box.y, viewport.width - box.x - box.width, viewport.height - box.y - box.height) : -1;
  }).toBeGreaterThanOrEqual(15);
}

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`Home has a gray unpractised path, retained colors and accessible choices at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const control = await mockHome(page);
    await page.goto('/dashboard');
    const current = page.locator('.path-day.is-today');
    await expect(current.getByRole('heading', { name: "Today's plan" })).toBeInViewport();
    await expect(current.locator('.path-node')).toHaveCount(6);
    expect(await current.locator('.path-node').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-activity'))))
      .toEqual(['vocabulary', 'listening', 'shadowing', 'reading', 'reserved-5', 'reserved-6']);
    await expect(current.locator('.is-practiced')).toHaveCount(1);
    const listening = current.locator('[data-activity="listening"]');
    await expect(listening).toHaveClass(/is-current/u);
    await expect(listening).toHaveCSS('background-color', 'rgb(230, 232, 234)');
    await expect(page.locator(`[data-day="${shift(-1)}"] .is-practiced`)).toHaveCount(3);
    await expect(page.locator('.is-future .is-practiced')).toHaveCount(0);
    await expect(page.locator('.is-future .path-node:disabled')).toHaveCount(12);
    await expect(current.locator('.is-reserved:disabled')).toHaveCount(2);
    await expect(current.locator('.book-wagon')).toHaveClass(/is-quiet/u);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`home-${viewport.width}.png`) });

    await listening.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Listening' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Start', exact: true })).toHaveAttribute('href', '/bbc-6-minute-english');
    await expectFits(dialog, page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(listening).toBeFocused();
    await expect(listening).toHaveAttribute('data-status', 'available');

    const wagon = current.locator('.book-wagon');
    await wagon.click();
    await expect(dialog.getByRole('heading', { name: 'Box 1 practice' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Word by word' })).toHaveAttribute('href', '/review?mode=box1');
    await expect(dialog.getByRole('link', { name: 'Sentence by sentence' })).toHaveAttribute('href', '/sentence?house=1');
    await expectFits(dialog, page);
    await page.screenshot({ path: testInfo.outputPath(`home-options-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await expect(wagon).toBeFocused();
    await current.locator('[data-activity="reading"]').click();
    await expect(dialog).toContainText('Reading practice is coming soon.');
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(control.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('scrolling up prepends history without moving the existing day on screen', async ({ page }) => {
  const control = await mockHome(page);
  let release!: () => void;
  control.olderGate = new Promise<void>(resolve => { release = resolve; });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: "Today's plan" })).toBeInViewport();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => control.requests.includes(shift(-6))).toBe(true);
  const anchor = page.locator(`[data-day="${shift(-6)}"]`);
  const top = (await anchor.boundingBox())!.y;
  release();
  await expect(page.locator('.path-day')).toHaveCount(16);
  await expect.poll(async () => Math.abs((await anchor.boundingBox())!.y - top)).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: 'Back to today' }).click();
  await expect(page.getByRole('heading', { name: "Today's plan" })).toBeInViewport();
  await expect(page.locator(`[data-day="${shift(-13)}"] .is-practiced`)).toHaveCount(1);
});

test('network errors preserve loaded evidence and a subsequent refresh reads new persisted activity', async ({ page }) => {
  const control = await mockHome(page);
  await page.goto('/dashboard');
  const current = page.locator('.path-day.is-today');
  await expect(current.locator('.is-practiced')).toHaveCount(1);
  control.fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert')).toContainText('Showing the last loaded record');
  await expect(current.locator('.is-practiced')).toHaveCount(1);
  control.fail = false;
  control.activities = ['vocabulary', 'listening'];
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(current.locator('.is-practiced')).toHaveCount(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(current.locator('.is-practiced')).toHaveCount(2);
  expect(control.writes).toEqual([]);
});
