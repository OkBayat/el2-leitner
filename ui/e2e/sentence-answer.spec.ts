import { expect, test } from '@playwright/test';

const deck = {
	practice: { mode: 'sentence', house: 1, retryGap: 3 },
	summary: { totalWords: 1, totalSentences: 1 },
	cards: [{
		id: 'layout-stationery', term: 'stationery', accepted: ['stationery', 'a much longer accepted alias'], box: 1, mistakes: 0,
		definitions: [{ id: 'd1', text: 'Materials for writing, such as paper and pens.', languageCode: 'en', collectionTitle: 'Campus vocabulary' }],
		sentences: [{ id: 's1', text: 'The campus shop sells pens, notebooks, and other stationery.', before: 'The campus shop sells pens, notebooks, and other ', after: '.', category: 'General', sourceItemNumber: null, variantNumber: null }],
	}],
};

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
	test.describe(`Sentence answer at ${viewport.width}px`, () => {
		const mobile = viewport.width < 600;
		test.use({ viewport, isMobile: mobile, hasTouch: mobile });

		test('fits the actual word and opens a non-modal definition popover without disrupting answers', async ({ page }) => {
			let deckRequests = 0;
			await page.route('**/api/learning/sentence-practice?house=1', async (route) => {
				deckRequests += 1;
				await route.fulfill({ json: deck });
			});
			await page.goto('/register');
			await page.getByLabel('Email').fill(`e2e-cloze-${viewport.width}-${Date.now()}@example.com`);
			await page.getByLabel('Password').fill('password123');
			await page.getByRole('button', { name: 'Create account' }).click();
			await expect(page).toHaveURL(/\/dashboard$/u);
			await page.getByTestId('start-sentence-practice').click();

			const field = page.getByTestId('sentence-answer-input');
			const panel = page.getByTestId('sentence-word-details');
			await expect(field).toBeFocused();
			await expect(panel).toHaveCount(0);
			expect(await field.evaluate((element) => element.tagName)).toBe('TEXTAREA');
			await expect(field).toHaveCSS('border-bottom-style', 'dashed');
			const wordWidth = await page.getByTestId('sentence-answer-measure').evaluate((element) => {
				const range = document.createRange();
				range.selectNodeContents(element);
				return range.getBoundingClientRect().width;
			});
			expect(Math.abs((await field.boundingBox())!.width - wordWidth)).toBeLessThan(2);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

			if (mobile) await field.tap();
			else await field.click();
			await expect(panel).toBeVisible();
			await expect(field).toBeFocused();
			await expect(field).toHaveValue('');
			await expect(panel).toContainText('Materials for writing, such as paper and pens.');
			await expect(panel).toContainText('Campus vocabulary');
			await expect(panel.locator('mark')).toHaveText('…');
			const bounds = (await panel.boundingBox())!;
			expect(bounds.x).toBeGreaterThanOrEqual(8);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 8);
			expect(bounds.y).toBeGreaterThanOrEqual(8);
			expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 8);

			await field.press('Escape');
			await expect(panel).toHaveCount(0);
			await expect(field).toBeFocused();
			await field.press('Alt+ArrowDown');
			await expect(panel).toBeVisible();
			await page.getByRole('button', { name: 'Close word meaning' }).click();
			await expect(panel).toHaveCount(0);
			await expect(field).toBeFocused();
			await field.fill('stationery');
			await field.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
			await expect(page.getByTestId('sentence-action-footer')).toHaveClass(/neutral/u);
			await field.press('Enter');
			await expect(page.getByTestId('sentence-action-footer')).toHaveClass(/success/u);
			await expect(field).toHaveValue('stationery');
			await expect(field).not.toBeEditable();
			await field.click();
			await expect(panel.locator('mark')).toHaveText('stationery');
			await page.getByRole('button', { name: 'Continue', exact: true }).click();
			await expect(field).toHaveValue('');
			await expect(field).toBeEditable();
			await expect(field).toBeFocused();
			await expect(panel).toHaveCount(0);
			expect(deckRequests).toBe(1);
		});
	});
}
