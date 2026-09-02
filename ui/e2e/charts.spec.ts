import {expect, test, type Locator, type Page} from '@playwright/test';

const PASSWORD = 'password123';
let accountCounter = 0;

async function authenticate(page: Page): Promise<void> {
	accountCounter += 1;
	await page.goto('/register');
	await page.getByLabel('Email').fill(`e2e-charts-${Date.now()}-${accountCounter}@example.com`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', {name: 'Create account'}).click();
	await expect(page).toHaveURL(/\/dashboard$/u);
	await expect(page.getByText("Today's plan")).toBeVisible({timeout: 10_000});
}

async function expectRenderedCanvas(chart: Locator): Promise<void> {
	await expect(chart).toBeVisible();
	const canvas = chart.locator('canvas');
	await expect(canvas).toBeVisible();
	await expect.poll(async () => canvas.evaluate((element) => ({
		clientHeight: element.clientHeight,
		clientWidth: element.clientWidth,
		height: element.height,
		width: element.width,
	}))).toMatchObject({
		clientHeight: expect.any(Number),
		clientWidth: expect.any(Number),
		height: expect.any(Number),
		width: expect.any(Number),
	});
	const dimensions = await canvas.evaluate((element) => ({
		clientHeight: element.clientHeight,
		clientWidth: element.clientWidth,
		height: element.height,
		width: element.width,
	}));
	expect(dimensions.clientWidth).toBeGreaterThan(0);
	expect(dimensions.clientHeight).toBeGreaterThan(0);
	expect(dimensions.width).toBeGreaterThan(0);
	expect(dimensions.height).toBeGreaterThan(0);
}

test('dashboard renders Leitner coverage and 14-day activity with Chart.js canvases', async ({page}) => {
	await authenticate(page);
	await expect(page.getByText('14-day activity')).toBeVisible();
	await expect(page.locator('app-learning-chart')).toHaveCount(2);

	const coverage = page.getByRole('img', {name: 'Percentage of vocabulary that has entered the Leitner system'});
	const activity = page.getByRole('img', {name: 'Correct primary answers over the last 14 days'});
	await expectRenderedCanvas(coverage);
	await expectRenderedCanvas(activity);
	await expect(coverage.locator('.doughnut-center')).toBeVisible();
	await expect(activity.locator('.doughnut-center')).toHaveCount(0);
	await expect(page.getByText('Correct primary answers per day')).toBeVisible();
});

test('reports render 30-day accuracy as one Chart.js line canvas', async ({page}) => {
	await authenticate(page);
	await page.goto('/reports');
	await expect(page.getByRole('heading', {name: 'Progress Report'})).toBeVisible();
	await expect(page.getByText('30-day accuracy')).toBeVisible();
	await expect(page.locator('app-learning-chart')).toHaveCount(1);

	const chart = page.getByRole('img', {name: 'Daily answer accuracy over the last 30 days'});
	await expectRenderedCanvas(chart);
	await expect(chart.locator('.doughnut-center')).toHaveCount(0);
});
