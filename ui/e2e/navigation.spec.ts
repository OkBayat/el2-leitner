import {expect, test, type Page} from '@playwright/test';
import {createFreshState} from '../src/app/domain/learning/learning-rules';

test.use({timezoneId: 'UTC', reducedMotion: 'reduce'});

async function mockNavigation(page: Page, theme: 'light' | 'dark' = 'light') {
	const today = new Date().toISOString().slice(0, 10);
	const state = createFreshState([
		{id: 'fixture-due', term: 'practice', box: 1, due: today, introducedOn: today},
		{id: 'fixture-mastered', term: 'learned', box: 5, masteredAt: `${today}T00:00:00Z`},
	]);
	state.settings = {...state.settings, dailyNew: 0, theme};
	state.daily[today] = {attempts: 1, correct: 1, wrong: 0, newAdded: 0, sessions: 1, durationSeconds: 30};
	let revision = 1;
	const writes: string[] = [];
	await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', {configurable: true, value: true}));
	page.on('request', request => {
		if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(new URL(request.url()).pathname);
	});
	await page.route('**/api/auth/me', route => route.fulfill({json: {user: {id: 'navigation-fixture', email: 'learner@example.test'}}}));
	await page.route('**/api/auth/logout', route => route.fulfill({json: {ok: true}}));
	await page.route('**/api/state**', route => route.fulfill({json: {state, revision}}));
	await page.route('**/api/settings/theme', route => {
		state.settings.theme = route.request().postDataJSON().theme;
		revision += 1;
		return route.fulfill({json: {theme: state.settings.theme, revision}});
	});
	await page.route('**/api/learning/timeline?**', route => route.fulfill({json: {
		today, nextBefore: null, limitedHistory: false,
		days: [{day: today, activities: ['vocabulary'], boxOnePracticed: false}],
	}}));
	return {writes};
}

for (const theme of ['light', 'dark'] as const) {
	for (const width of [320, 390, 768, 1024, 1440]) {
		test(`navigation is usable at ${width}px in ${theme} theme`, async ({page}, testInfo) => {
			await page.setViewportSize({width, height: 900});
			const errors: string[] = [];
			page.on('pageerror', error => errors.push(error.message));
			const {writes} = await mockNavigation(page, theme);
			await page.goto('/dashboard');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expect(page.getByRole('heading', {name: "Today's plan"})).toBeInViewport();
			await expect(page.locator('.topbar, .product-tabs')).toHaveCount(0);
			const sidebar = page.locator('.desktop-sidebar');
			const dock = page.getByRole('navigation', {name: 'Mobile navigation'});
			if (width >= 768) {
				await expect(sidebar).toBeVisible();
				await expect(dock).toBeHidden();
				await expect(page.locator('.mobile-status')).toBeHidden();
				const sidebarBox = (await sidebar.boundingBox())!;
				expect(sidebarBox.x).toBe(0);
				expect((await page.locator('main').boundingBox())!.x).toBeGreaterThanOrEqual(sidebarBox.width);
				await expect(sidebar.getByRole('link', {name: 'Home', exact: true})).toHaveAttribute('aria-current', 'page');
				const heading = page.locator('.is-today > .day-heading');
				expect((await heading.boundingBox())!.y).toBeLessThan(40);
			} else {
				await expect(sidebar).toBeHidden();
				await expect(page.locator('.mobile-status')).toBeVisible();
				await expect(dock).toBeVisible();
				await expect(dock.locator('a, button')).toHaveCount(6);
				await expect(dock.getByRole('link', {name: 'Home', exact: true})).toHaveAttribute('aria-current', 'page');
				await expect(page.locator('.mobile-status').getByRole('link', {name: '1 words due for review'})).toBeVisible();
				await expect(page.locator('.mobile-status').getByRole('link', {name: '1 mastered words'})).toBeVisible();
				const box = (await dock.boundingBox())!;
				expect(box.x).toBe(0);
				expect(box.width).toBe(width);
				for (const target of await dock.locator('a, button').all()) {
					const rect = (await target.boundingBox())!;
					expect(rect.width).toBeGreaterThanOrEqual(44);
					expect(rect.height).toBeGreaterThanOrEqual(44);
					expect(rect.x).toBeGreaterThanOrEqual(0);
					expect(rect.x + rect.width).toBeLessThanOrEqual(width);
				}
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.screenshot({path: testInfo.outputPath(`navigation-${theme}-${width}.png`)});
			await page.evaluate(() => scrollBy({top: 400, behavior: 'instant'}));
			await expect(width >= 768 ? sidebar : dock).toBeInViewport();
			if (width < 768) await expect(page.locator('.mobile-status')).toBeInViewport();
			expect(writes).toEqual([]);
			expect(errors).toEqual([]);
		});
	}
}

test('mobile overflow retains keyboard focus, settings, theme switching, story access and sign out', async ({page}) => {
	await page.setViewportSize({width: 390, height: 844});
	const {writes} = await mockNavigation(page);
	await page.goto('/dashboard');
	const more = page.getByTestId('mobile-more');
	await more.focus();
	await page.keyboard.press('Enter');
	const menu = page.getByRole('menu');
	await expect(menu).toBeVisible();
	for (const name of ['Settings', 'Progress', 'Overview', 'Create progress story', 'Change theme', 'Sign out']) {
		await expect(menu.getByRole('menuitem', {name})).toBeVisible();
	}
	await page.keyboard.press('Escape');
	await expect(menu).toHaveCount(0);
	await expect(more).toBeFocused();
	await more.click();
	await menu.getByRole('menuitem', {name: 'Change theme'}).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(writes).toEqual(['/api/settings/theme']);
	await more.click();
	await menu.getByRole('menuitem', {name: 'Settings', exact: true}).click();
	await expect(page).toHaveURL(/\/settings$/u);
	await expect(more).toHaveClass(/active-mobile/u);
	await expect(menu).toHaveCount(0);
	await more.click();
	await menu.getByRole('menuitem', {name: 'Sign out'}).click();
	await expect(page).toHaveURL(/\/login$/u);
	await expect(page.locator('app-shell')).toHaveCount(0);
	expect(writes).toContain('/api/auth/logout');
});

test('desktop keyboard navigation skips chrome and menus close when their trigger changes breakpoint', async ({page}) => {
	await page.setViewportSize({width: 1440, height: 900});
	await mockNavigation(page);
	await page.goto('/dashboard');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', {name: 'Skip to content'})).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('main')).toBeFocused();
	const more = page.getByTestId('desktop-more');
	await more.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('menu')).toBeVisible();
	await page.setViewportSize({width: 390, height: 844});
	await expect(page.getByRole('menu')).toHaveCount(0);
	await expect(page.getByTestId('mobile-more')).toBeVisible();
	await page.getByTestId('mobile-more').click();
	await expect(page.getByRole('menu')).toBeVisible();
});

test('PWA safe areas and the bottom of the timeline stay clear of the fixed dock', async ({page}) => {
	await page.setViewportSize({width: 390, height: 844});
	await mockNavigation(page);
	await page.goto('/dashboard');
	await expect(page.getByRole('heading', {name: "Today's plan"})).toBeVisible();
	await page.evaluate(() => {
		for (const [side, value] of Object.entries({top: '20px', bottom: '34px', left: '12px', right: '12px'})) {
			document.documentElement.style.setProperty(`--safe-area-${side}`, value);
		}
	});
	await expect(page.locator('.mobile-status')).toHaveCSS('height', '84px');
	const dock = page.locator('.mobile-nav');
	await expect(dock).toHaveCSS('height', '114px');
	await page.evaluate(() => scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
	const dockBox = (await dock.boundingBox())!;
	const finalDay = (await page.locator('.path-day').last().boundingBox())!;
	expect(finalDay.y + finalDay.height).toBeLessThan(dockBox.y);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const todayButton = page.getByRole('button', {name: 'Back to today'});
	await expect(todayButton).toBeVisible();
	const buttonBox = (await todayButton.boundingBox())!;
	expect(buttonBox.y + buttonBox.height).toBeLessThan(dockBox.y);
});
