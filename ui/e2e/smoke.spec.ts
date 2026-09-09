import {expect, test, type Page} from '@playwright/test';
import {finishNewLearnerWelcome} from './support/new-learner';

const PASSWORD = 'password123';
let accountSequence = 0;

async function registerLearner(page: Page, purpose: string): Promise<void> {
	accountSequence += 1;
	const email = `smoke-${purpose}-${Date.now()}-${accountSequence}@example.com`;
	const registration = page.waitForResponse(response =>
		response.request().method() === 'POST'
		&& new URL(response.url()).pathname === '/api/auth/register'
		&& response.ok(),
	);
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', {name: 'Create account'}).click();
	await registration;
	await finishNewLearnerWelcome(page);
	await expect(page.getByRole('heading', {name: 'Today', exact: true})).toBeVisible();
}

async function firstDueTerm(page: Page): Promise<string> {
	let term = '';
	await expect.poll(async () => {
		term = await page.evaluate(async () => {
			const response = await fetch('/api/state', {credentials: 'include'});
			const payload = await response.json();
			const today = new Date().toLocaleDateString('en-CA');
			return payload.state.words.find((word: any) =>
				word.box > 0
				&& !word.masteredAt
				&& word.due
				&& word.due <= today
				&& (!word.blockedUntil || word.blockedUntil <= today),
			)?.term ?? '';
		});
		return term;
	}, {message: 'daily activation should provide a review card'}).not.toBe('');
	return term;
}

test('application starts and a learner can register', async ({page}) => {
	await registerLearner(page, 'startup');
	await expect(page.getByText('Vocora', {exact: true}).first()).toBeVisible();
});

test('learner completes a review and the result is persisted', async ({page}) => {
	await registerLearner(page, 'review');
	const term = await firstDueTerm(page);

	await page.goto('/review');
	await page.getByRole('button', {name: 'Start session'}).click();
	await page.getByLabel('Your answer').fill(term);
	await page.getByRole('button', {name: 'Check answer'}).click();
	await expect(page.getByText('Correct!', {exact: true})).toBeVisible();
	await expect.poll(() => page.evaluate(async expectedTerm => {
		const response = await fetch('/api/state', {credentials: 'include', cache: 'no-store'});
		const payload = await response.json();
		const latest = payload.state.history.at(-1);
		return latest?.correct === true && latest?.term === expectedTerm;
	}, term), {message: 'the completed review should reach canonical persistence'}).toBe(true);
});

test('learner starts the first course exercise from the library', async ({page}) => {
	await registerLearner(page, 'course');
	await page.goto('/library');
	const course = page.locator('mat-card').filter({hasText: 'Cambridge Vocabulary for IELTS'});
	await course.getByTestId('library-learning-path-action').click();

	await expect(page).toHaveURL(/\/learning-paths\/\d+\/lessons\/\d+\/exercises\/\d+$/u);
	await expect(page.getByTestId('vocabulary-intake')).toBeVisible();
	await page.getByRole('button', {name: "Let's Go"}).click();
	await expect(page.getByRole('progressbar')).toBeVisible();
});
