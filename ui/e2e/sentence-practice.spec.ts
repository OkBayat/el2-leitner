import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'password123';
const ANSWER = 'name';

function sentence(card: number, variant: number) {
	const audioId = card * 10 + variant;
	return {
		id: `sentence-${card}-${variant}`,
		sourceItemNumber: card * 100 + variant,
		variantNumber: 1,
		category: 'Tatoeba',
		text: variant === 1 ? `My name is person ${card}.` : `Her name is person ${card}.`,
		before: variant === 1 ? 'My ' : 'Her ',
		after: ` is person ${card}.`,
		audioId: String(audioId),
		audioUrl: `https://tatoeba.org/audio/download/${audioId}`,
		audioContributor: 'e2e-speaker',
		audioLicense: 'CC BY 4.0',
		audioAttributionUrl: null,
	};
}

const deck = {
	practice: { mode: 'sentence', house: 1, retryGap: 3 },
	summary: { totalWords: 5, totalSentences: 10 },
	cards: [1, 2, 3, 4, 5].map((card) => ({
		id: `word-name-${card}`,
		term: ANSWER,
		accepted: [ANSWER],
		box: 1,
		mistakes: 0,
		sentences: [sentence(card, 1), sentence(card, 2)],
	})),
};

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

async function installAudioSpy(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(window as any).__vocoraPlayedSentenceAudio = [];
		class FakeAudio {
			preload = '';
			playbackRate = 1;
			currentTime = 0;
			constructor(readonly src: string) {}
			play(): Promise<void> {
				(window as any).__vocoraPlayedSentenceAudio.push({ src: this.src, rate: this.playbackRate });
				return Promise.resolve();
			}
			pause(): void {}
		}
		Object.defineProperty(window, 'Audio', { configurable: true, writable: true, value: FakeAudio });
	});
}

async function playedAudioCount(page: Page): Promise<number> {
	return page.evaluate(() => (window as any).__vocoraPlayedSentenceAudio?.length || 0);
}

async function sentenceContext(page: Page): Promise<string[]> {
	return page.getByTestId('sentence-cloze').locator('span').allTextContents();
}

async function answerCurrentCard(page: Page): Promise<void> {
	const input = page.getByTestId('sentence-answer-input');
	await input.fill(ANSWER);
	await input.press('Enter');
	await expect(page.getByTestId('sentence-action-footer')).toHaveClass(/success/u);
}

test('Sentence Practice plays full sentence audio, keeps Leitner state isolated and retries in a different sentence', async ({ page }) => {
	await installAudioSpy(page);
	await authenticate(page);
	await page.route('**/api/learning/sentence-practice?house=1', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(deck) });
	});
	const stateBefore = await learningState(page);

	await page.getByTestId('start-sentence-practice').click();
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

	await expect.poll(() => playedAudioCount(page), { timeout: 5_000 }).toBeGreaterThan(0);
	const firstPlayback = await page.evaluate(() => (window as any).__vocoraPlayedSentenceAudio[0]);
	expect(firstPlayback.src).toMatch(/^https:\/\/tatoeba\.org\/audio\/download\/\d+$/u);
	expect(firstPlayback.rate).toBe(1);
	await page.getByRole('button', { name: 'Slower' }).click();
	const slowerPlayback = await page.evaluate(() => (window as any).__vocoraPlayedSentenceAudio.at(-1));
	expect(slowerPlayback.rate).toBe(.75);

	const firstContext = await sentenceContext(page);
	await input.fill('__wrong__');
	await input.press('Enter');

	await expect(input).toHaveValue('__wrong__');
	await expect(input).not.toBeEditable();
	await expect(page.getByTestId('sentence-action-footer')).toHaveClass(/error/u);
	await expect(page.getByTestId('sentence-correct-answer')).toHaveText(ANSWER);
	await page.getByRole('button', { name: 'Continue' }).click();

	for (let index = 0; index < 3; index += 1) {
		await answerCurrentCard(page);
		await page.getByRole('button', { name: 'Continue' }).click();
	}

	const retryContext = await sentenceContext(page);
	expect(retryContext).not.toEqual(firstContext);
	await expect(page.getByText('Try the word again in a new sentence')).toBeVisible();
	await answerCurrentCard(page);

	const stateAfter = await learningState(page);
	expect(stateAfter).toEqual(stateBefore);

	await page.getByRole('button', { name: 'Continue' }).click();
	await page.getByRole('button', { name: 'Exit sentence practice' }).click();
	await page.getByRole('button', { name: 'Exit', exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard$/u);
});
