import {expect, test, type Page} from '@playwright/test';
import type {CollectionLearningPathView, LearningPathNodeState} from '../src/app/domain/collection-learning-path/learning-path';
import {createFreshState, localDay} from '../src/app/domain/learning/learning-rules';
import type {LibraryCollection} from '../src/app/domain/learning/models';

test.use({timezoneId: 'UTC', reducedMotion: 'reduce'});

const today = localDay();
const completedAt = `${today}T12:00:00.000Z`;
const courses: LibraryCollection[] = [
	{
		id: 'cambridge-vocabulary-for-ielts',
		slug: 'cambridge-vocabulary-for-ielts',
		title: 'Cambridge Vocabulary for IELTS',
		kind: 'book',
		visibility: 'public',
		status: 'published',
		contentVersion: 1,
		wordCount: 100,
		subscribed: true,
	},
	{
		id: 'american-english-file-3',
		slug: 'american-english-file-3',
		title: 'American English File 3',
		kind: 'book',
		visibility: 'public',
		status: 'published',
		contentVersion: 1,
		wordCount: 100,
		subscribed: true,
	},
	{
		id: 'bbc-six-minute-english',
		slug: 'bbc-six-minute-english',
		title: 'BBC 6 Minute English',
		kind: 'course',
		visibility: 'public',
		status: 'published',
		contentVersion: 1,
		wordCount: 100,
		subscribed: true,
	},
];

function pathView(collection: LibraryCollection, practicedToday: boolean): CollectionLearningPathView {
	const exerciseState: LearningPathNodeState = practicedToday ? 'completed' : 'available';
	return {
		access: {canProgress: true},
		resumePoint: {
			lessonId: `${collection.id}-lesson`,
			exerciseId: `${collection.id}-exercise`,
		},
		path: {
			id: `${collection.id}-path`,
			collectionId: collection.id,
			title: collection.title,
			mode: collection.kind === 'course' ? 'rolling' : 'finite',
			status: 'published',
			contentVersion: '1',
			learnerStatus: 'in_progress',
			progress: null,
		},
		lessons: [
			{
				id: `${collection.id}-lesson`,
				title: collection.kind === 'course' ? 'Keeping kids off smartphones' : 'Unit 1 · Growing up',
				position: 1,
				sourceKind: null,
				sourceRef: null,
				state: 'in_progress',
				progress: null,
				exercises: [
					{
						id: `${collection.id}-exercise`,
						position: 1,
						type: 'slide-base',
						schemaVersion: 1,
						required: true,
						completionPolicy: 'slide-completion',
						config: {},
						state: exerciseState,
						progress: practicedToday
							? {
									status: 'completed',
									startedAt: completedAt,
									completedAt,
									lastActivityAt: completedAt,
								}
							: null,
					},
				],
			},
		],
	};
}

async function mockDashboard(page: Page, theme: 'light' | 'dark') {
	let reviewDue = true;
	const writes: string[] = [];
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'standalone', {
			configurable: true,
			value: true,
		}),
	);
	page.on('request', request => {
		if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.url());
	});
	await page.route('**/api/auth/me', route =>
		route.fulfill({
			json: {
				user: {id: 'home-dashboard', email: 'learner@example.test'},
			},
		}),
	);
	await page.route('**/api/state**', route => {
		const state = createFreshState(
			reviewDue
				? [
						{
							id: 'due',
							term: 'practice',
							box: 1,
							due: today,
							introducedOn: today,
						},
					]
				: [],
		);
		state.settings = {...state.settings, dailyNew: 0, theme};
		return route.fulfill({json: {state, revision: 1}});
	});
	await page.route(/\/api\/library$/u, route => route.fulfill({json: {collections: courses}}));
	await page.route(/\/api\/learning-paths\/collections$/u, route =>
		route.fulfill({
			json: {collectionIds: courses.map(course => course.id)},
		}),
	);
	await page.route(/\/api\/learning-paths\/collections\/[^/?]+$/u, route => {
		const collectionId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1) ?? '');
		const collection = courses.find(candidate => candidate.id === collectionId);
		if (!collection)
			return route.fulfill({
				status: 404,
				json: {error: {message: 'Course not found'}},
			});
		return route.fulfill({
			json: pathView(collection, collection.id !== 'american-english-file-3'),
		});
	});
	return {
		writes,
		completeReview: () => {
			reviewDue = false;
		},
	};
}

for (const theme of ['light', 'dark'] as const) {
	for (const viewport of [
		{width: 320, height: 740},
		{width: 390, height: 844},
		{width: 1280, height: 900},
	]) {
		test(`main dashboard stays focused at ${viewport.width}px in ${theme} theme`, async ({page}, testInfo) => {
			await page.setViewportSize(viewport);
			const errors: string[] = [];
			page.on('pageerror', error => errors.push(error.message));
			const control = await mockDashboard(page, theme);
			await page.goto('/dashboard');

			const dashboard = page.getByTestId('home-dashboard');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expect(dashboard.getByRole('heading', {name: 'Today', exact: true})).toBeVisible();
			await expect(page.getByTestId('daily-review-card')).toHaveCount(1);
			await expect(page.getByTestId('daily-review-card')).toContainText('Your daily review is ready');
			await expect(page.getByTestId('start-review')).toHaveAttribute('href', '/review');
			await expect(page.getByTestId('home-course-card')).toHaveCount(3);
			const cambridge = page.getByTestId('home-course-card').filter({hasText: 'Cambridge Vocabulary for IELTS'});
			const american = page.getByTestId('home-course-card').filter({hasText: 'American English File 3'});
			const bbc = page.getByTestId('home-course-card').filter({hasText: 'BBC 6 Minute English'});
			await expect(cambridge.getByTestId('home-course-status')).toContainText('Done');
			await expect(american.getByTestId('home-course-status')).toContainText('Not practiced');
			await expect(bbc.getByTestId('home-course-status')).toContainText('Done');
			await expect(american).toBeEnabled();
			await expect(dashboard).not.toContainText(/XP|Streak|Mistakes|Achievement|%/u);

			const dashboardBox = (await dashboard.boundingBox())!;
			expect(dashboardBox.width).toBeLessThanOrEqual(760);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

			const dock = page.getByRole('navigation', {
				name: 'Mobile navigation',
			});
			if (viewport.width < 768) {
				await expect(page.locator('.mobile-status')).toBeVisible();
				await expect(page.getByTestId('desktop-right-rail')).toBeHidden();
				await expect(page.locator('.sidebar-summary')).toBeHidden();
				await expect(dock).toBeVisible();
				const labels = await dock.locator('.mobile-nav-label').allTextContents();
				expect(labels.slice(0, 3)).toEqual(['Home', 'Courses', 'Leitner']);
			} else {
				await expect(page.locator('.mobile-status')).toBeHidden();
				await expect(page.getByTestId('desktop-right-rail')).toBeVisible();
				await expect(page.locator('.sidebar-summary')).toBeVisible();
				await expect(dock).toBeHidden();
			}

			await page.screenshot({
				path: testInfo.outputPath(`home-dashboard-${theme}-${viewport.width}.png`),
			});
			if (viewport.width === 390) {
				await american.click();
				await expect(page).toHaveURL(
					/\/library\/american-english-file-3\/learning-path$/u,
				);
			}
			expect(control.writes).toEqual([]);
			expect(errors).toEqual([]);
		});
	}
}

test('completed daily review offers only free Leitner word practice', async ({page}) => {
	const control = await mockDashboard(page, 'light');
	control.completeReview();
	await page.goto('/dashboard');

	const review = page.getByTestId('daily-review-card');
	await expect(review).toContainText("Today's review completed");
	await expect(page.getByTestId('practice-words')).toHaveAttribute('href', '/review?mode=box1');
	await expect(review.getByRole('link')).toHaveCount(1);
	expect(control.writes).toEqual([]);
});
