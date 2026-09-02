import {expect, test, type Page} from '@playwright/test';

const PASSWORD = 'password123';

async function authenticate(page: Page): Promise<void> {
	await page.goto('/register');
	await page.getByLabel('Email').fill(`e2e-charts-${Date.now()}@example.com`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', {name: 'Create account'}).click();
	await expect(page).toHaveURL(/\/dashboard$/u);
	await expect(page.getByText("Today's plan")).toBeVisible({timeout: 10_000});
}

test('dashboard activity uses a responsive 14-bar SVG chart', async ({page}) => {
	await authenticate(page);
	const card = page.getByRole('heading', {name: '14-day activity'}).locator('..').locator('..');
	const chart = card.locator('app-learning-chart');
	await expect(chart).toBeVisible();
	await expect(chart.locator('svg')).toBeVisible();
	await expect(chart.locator('rect.bar')).toHaveCount(14);
	await expect(chart.locator('.grid-line')).toHaveCount(5);
	await expect(card.getByText('Correct primary answers per day')).toBeVisible();
});

test('reports render 30-day accuracy as one line chart rather than thirty bars', async ({page}) => {
	await authenticate(page);
	await page.goto('/reports');
	await expect(page.getByRole('heading', {name: 'Progress Report'})).toBeVisible();
	const card = page.getByRole('heading', {name: '30-day accuracy'}).locator('..').locator('..');
	const chart = card.locator('app-learning-chart');
	await expect(chart).toBeVisible();
	await expect(chart.locator('svg')).toBeVisible();
	await expect(chart.locator('path.line')).toHaveCount(1);
	await expect(chart.locator('rect.bar')).toHaveCount(0);
	await expect(chart.locator('.grid-line')).toHaveCount(5);
});
