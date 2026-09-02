import {expect, test, type Page} from '@playwright/test';

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

test('dashboard activity uses a responsive 14-bar SVG chart', async ({page}) => {
	await authenticate(page);
	const chart = page.locator('app-learning-chart');
	await expect(page.getByText('14-day activity')).toBeVisible();
	await expect(chart).toHaveCount(1);
	await expect(chart).toBeVisible();
	await expect(chart.locator('svg')).toBeVisible();
	await expect(chart.locator('rect.bar')).toHaveCount(14);
	await expect(chart.locator('.grid-line')).toHaveCount(5);
	await expect(page.getByText('Correct primary answers per day')).toBeVisible();
});

test('reports render 30-day accuracy as one line chart rather than thirty bars', async ({page}) => {
	await authenticate(page);
	await page.goto('/reports');
	await expect(page.getByRole('heading', {name: 'Progress Report'})).toBeVisible();
	await expect(page.getByText('30-day accuracy')).toBeVisible();
	const chart = page.locator('app-learning-chart');
	await expect(chart).toHaveCount(1);
	await expect(chart).toBeVisible();
	await expect(chart.locator('svg')).toBeVisible();
	await expect(chart.locator('path.line')).toHaveCount(1);
	await expect(chart.locator('rect.bar')).toHaveCount(0);
	await expect(chart.locator('.grid-line')).toHaveCount(5);
});
