import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'password123';

async function authenticate(page: Page): Promise<void> {
	await page.goto('/register');
	await page.getByLabel('Email').fill(`e2e-sentence-${Date.now()}@example.com`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/dashboard$/u);
	await page.getByTestId('home-box-one').click();
	await expect(page.getByTestId('start-sentence-practice')).toBeVisible({ timeout: 10_000 });
}

async function learningState(page: Page): Promise<any> {
	return page.evaluate(async () => {
		const response = await fetch('/api/state', { credentials: 'include' });
		if (!response.ok) throw new Error(`State request failed with ${response.status}`);
		return response.json();
	});
}

async function browserLocalDay(page: Page): Promise<string> {
	return page.evaluate(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	});
}

async function installSpeechSpy(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(window as any).__vocoraSpokenWords = [];
		(window as any).__vocoraSpokenUtterances = [];
		const speech = window.speechSynthesis;
		Object.defineProperty(speech, 'cancel', { configurable: true, value: () => undefined });
		Object.defineProperty(speech, 'getVoices', { configurable: true, value: () => [] });
		Object.defineProperty(speech, 'speak', {
			configurable: true,
			value: (utterance: SpeechSynthesisUtterance) => {
				(window as any).__vocoraSpokenWords.push({ text: utterance.text, rate: utterance.rate });
				(window as any).__vocoraSpokenUtterances.push(utterance);
			},
		});
	});
}

async function spokenSentence(page: Page, index: number): Promise<string> {
	let sentence = '';
	await expect.poll(async () => {
		sentence = await page.evaluate((position) => (window as any).__vocoraSpokenWords?.[position]?.text || '', index);
		return sentence;
	}, { timeout: 5_000, message: `sentence pronunciation ${index + 1} should be played` }).not.toBe('');
	return sentence;
}

async function sentenceContext(page: Page): Promise<string[]> {
	return page.getByTestId('sentence-cloze').locator(':scope > span').allTextContents();
}

async function emitSpeechWordBoundary(page: Page, pronunciationIndex: number, charIndex: number): Promise<void> {
	await page.evaluate(({ position, boundary }) => {
		const utterance = (window as any).__vocoraSpokenUtterances?.[position] as any;
		if (!utterance) throw new Error(`Missing spoken utterance ${position}`);
		utterance.onstart?.({});
		utterance.onboundary?.({ name: 'word', charIndex: boundary, charLength: 1 });
	}, { position: pronunciationIndex, boundary: charIndex });
}

async function emitSpeechEnd(page: Page, pronunciationIndex: number): Promise<void> {
	await page.evaluate((position) => {
		const utterance = (window as any).__vocoraSpokenUtterances?.[position] as any;
		if (!utterance) throw new Error(`Missing spoken utterance ${position}`);
		utterance.onend?.({});
	}, pronunciationIndex);
}

function answerFromSentence(sentence: string, context: string[]): string {
	const [before = '', after = ''] = context;
	if (!sentence.startsWith(before) || !sentence.endsWith(after)) {
		throw new Error(`Spoken sentence does not match visible cloze context: ${sentence}`);
	}
	const end = after ? sentence.length - after.length : sentence.length;
	return sentence.slice(before.length, end);
}

function visibleWordBoundary(sentence: string, context: string[]): number {
	const [before = '', after = ''] = context;
	const beforeWord = before.search(/\S/u);
	if (beforeWord >= 0) return beforeWord;
	const afterWord = after.search(/\S/u);
	if (afterWord >= 0) return sentence.length - after.length + afterWord;
	throw new Error('Expected at least one visible sentence word around the cloze.');
}

async function answerCurrentCard(page: Page, pronunciationIndex: number): Promise<{ answer: string; sentence: string }> {
	const sentence = await spokenSentence(page, pronunciationIndex);
	const context = await sentenceContext(page);
	const answer = answerFromSentence(sentence, context);
	const input = page.getByTestId('sentence-answer-input');
	await input.fill(answer);
	await input.press('Enter');
	await expect(page.getByTestId('sentence-action-footer')).toHaveClass(/success/u);
	return { answer, sentence };
}

test('Sentence Practice counts daily practice while keeping Leitner progress isolated', async ({ page }) => {
	await installSpeechSpy(page);
	await authenticate(page);
	const stateBefore = await learningState(page);
	const localDay = await browserLocalDay(page);

	const deckResponsePromise = page.waitForResponse((response) =>
		response.url().includes('/api/learning/sentence-practice?house=1') && response.status() === 200
	);
	await page.getByTestId('start-sentence-practice').click();
	const deckResponse = await deckResponsePromise;
	const deckUrl = deckResponse.url();
	const deck = await page.evaluate(async (url) => {
		const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
		if (!response.ok) throw new Error(`Sentence deck request failed with ${response.status}`);
		return response.json();
	}, deckUrl);
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
	await expect(input).toHaveCSS('border-bottom-style', 'dashed');
	expect(await input.evaluate((element) => element.tagName)).toBe('TEXTAREA');

	const firstSentence = await spokenSentence(page, 0);
	const firstContext = await sentenceContext(page);
	const firstHiddenAnswer = answerFromSentence(firstSentence, firstContext);
	expect(firstSentence.length).toBeGreaterThan(firstHiddenAnswer.length);

	await emitSpeechWordBoundary(page, 0, visibleWordBoundary(firstSentence, firstContext));
	const sentenceCloze = page.getByTestId('sentence-cloze');
	await expect(sentenceCloze).toHaveClass(/is-playing/u);
	await expect(sentenceCloze.locator('.sentence-playback-token.is-current-word')).toHaveCount(1);
	await expect(sentenceCloze.locator('.sentence-playback-token.is-current-word')).toHaveCSS('opacity', '1');
	await expect(sentenceCloze.locator('.sentence-playback-token:not(.is-current-word)').filter({ hasText: /\S/u }).first()).toHaveCSS('opacity', '0.48');
	await emitSpeechEnd(page, 0);
	await expect(sentenceCloze).not.toHaveClass(/is-playing/u);

	await input.fill('__wrong__');
	await input.press('Enter');

	await expect(input).toHaveValue('__wrong__');
	await expect(input).not.toBeEditable();
	await expect(page.getByTestId('sentence-action-footer')).toHaveClass(/error/u);
	await expect(page.getByTestId('sentence-correct-answer')).not.toHaveText('');
	await page.getByRole('button', { name: 'Continue' }).click();

	for (let index = 1; index <= 3; index += 1) {
		await answerCurrentCard(page, index);
		await page.getByRole('button', { name: 'Continue' }).click();
	}

	const retrySentence = await spokenSentence(page, 4);
	const retryContext = await sentenceContext(page);
	expect(retrySentence).not.toBe(firstSentence);
	expect(retryContext).not.toEqual(firstContext);
	await expect(page.getByText('Try the word again in a new sentence')).toBeVisible();
	await answerCurrentCard(page, 4);

	const stateAfter = await learningState(page);
	expect(stateAfter.revision).toBe(stateBefore.revision);
	expect(stateAfter.state.words).toEqual(stateBefore.state.words);
	expect(stateAfter.state.history).toEqual(stateBefore.state.history);

	const beforeDaily = stateBefore.state.daily?.[localDay] ?? {
		attempts: 0, correct: 0, wrong: 0, newAdded: 0, sessions: 0, durationSeconds: 0,
	};
	const afterDaily = stateAfter.state.daily?.[localDay];
	expect(afterDaily).toBeTruthy();
	expect(afterDaily.attempts).toBe(beforeDaily.attempts + 5);
	expect(afterDaily.correct).toBe(beforeDaily.correct + 4);
	expect(afterDaily.wrong).toBe(beforeDaily.wrong + 1);
	expect(afterDaily.newAdded).toBe(beforeDaily.newAdded);

	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByTestId('sentence-practice-session')).toBeVisible();
	await page.getByRole('button', { name: 'Exit sentence practice' }).click();
	await page.getByRole('button', { name: 'Exit', exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard$/u);
});
