import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'password123';

async function authenticate(page: Page): Promise<void> {
	await page.goto('/register');
	await page.getByLabel('Email').fill(`e2e-sentence-${Date.now()}@example.com`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/dashboard$/u);
	await expect(page.getByTestId('start-sentence-practice')).toBeVisible({ timeout: 10_000 });
}

async function learningState(page: Page): Promise<unknown> {
	return page.evaluate(async () => {
		const response = await fetch('/api/state', { credentials: 'include' });
		if (!response.ok) throw new Error(`State request failed with ${response.status}`);
		return response.json();
	});
}

async function installSpeechSpy(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(window as any).__vocoraSpokenWords = [];
		const speech = window.speechSynthesis;
		Object.defineProperty(speech, 'cancel', { configurable: true, value: () => undefined });
		Object.defineProperty(speech, 'getVoices', { configurable: true, value: () => [] });
		Object.defineProperty(speech, 'speak', {
			configurable: true,
			value: (utterance: SpeechSynthesisUtterance) => {
				(window as any).__vocoraSpokenWords.push({ text: utterance.text, rate: utterance.rate });
			},
		});
	});
}

async function spokenWord(page: Page, index: number): Promise<string> {
	let word = '';
	await expect.poll(async () => {
		word = await page.evaluate((position) => (window as any).__vocoraSpokenWords?.[position]?.text || '', index);
		return word;
	}, { timeout: 5_000, message: `pronunciation ${index + 1} should be played` }).not.toBe('');
	return word;
}

async function sentenceContext(page: Page): Promise<string[]> {
	return page.getByTestId('sentence-cloze').locator('span').allTextContents();
}

async function answerCurrentCard(page: Page, pronunciationIndex: number): Promise<string> {
	const word = await spokenWord(page, pronunciationIndex);
	const input = page.getByTestId('sentence-answer-input');
	await input.fill(word);
	await input.press('Enter');
	await expect(page.getByTestId('sentence-action-footer')).toHaveClass(/success/u);
	return word;
}

test('Sentence Practice keeps Leitner state isolated and retries a failed word in a different sentence', async ({ page }) => {
	await installSpeechSpy(page);
	await authenticate(page);
	const stateBefore = await learningState(page);

	const deckResponsePromise = page.waitForResponse((response) =>
		response.url().includes('/api/learning/sentence-practice?house=1') && response.status() === 200
	);
	await page.getByTestId('start-sentence-practice').click();
	const deckResponse = await deckResponsePromise;
	const deck = await deckResponse.json();
	expect(deck.practice).toEqual({ mode: 'sentence', house: 1, retryGap: 3 });
	expect(deck.cards.length).toBeGreaterThanOrEqual(4);

	await expect(page).toHaveURL(/\/sentence\?house=1$/u);
	await expect(page.locator('app-shell')).toHaveCount(0);
	const input = page.getByTestId('sentence-answer-input');
	await expect(input).toBeFocused();
	await expect(input).toHaveAttribute('autocomplete', 'off');
	await expect(input).toHaveAttribute('autocapitalize', 'none');
	await expect(input).toHaveAttribute('autocorrect', 'off');
	await expect(input).toHaveAttribute('spellcheck', 'false');
	await expect(input).toHaveCSS('border-top-width', '0px');
	await expect(input).toHaveCSS('border-left-width', '0px');
	await expect(input).toHaveCSS('border-right-width', '0px');
	await expect(input).not.toHaveCSS('border-bottom-width', '0px');

	const firstWord = await spokenWord(page, 0);
	const firstContext = await sentenceContext(page);
	await input.fill('__wrong__');
	await input.press('Enter');

	await expect(input).toHaveValue('__wrong__');
	await expect(input).not.toBeEditable();
	await expect(page.getByTestId('sentence-action-footer')).toHaveClass(/error/u);
	await expect(page.getByTestId('sentence-correct-answer')).toHaveText(firstWord);
	await page.getByRole('button', { name: 'Continue' }).click();

	for (let index = 1; index <= 3; index += 1) {
		await answerCurrentCard(page, index);
		await page.getByRole('button', { name: 'Continue' }).click();
	}

	const retryWord = await spokenWord(page, 4);
	const retryContext = await sentenceContext(page);
	expect(retryWord).toBe(firstWord);
	expect(retryContext).not.toEqual(firstContext);
	await expect(page.getByText('Try the word again in a new sentence')).toBeVisible();
	await answerCurrentCard(page, 4);

	const stateAfter = await learningState(page);
	expect(stateAfter).toEqual(stateBefore);

	await page.getByRole('button', { name: 'Continue' }).click();
	await page.getByRole('button', { name: 'Exit sentence practice' }).click();
	await page.getByRole('button', { name: 'Exit', exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard$/u);
});
