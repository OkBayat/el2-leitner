import {Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CollectionLearningPathFacade} from '../../application/collection-learning-path/collection-learning-path.facade';
import {SelectedCoursesFacade} from '../../application/collection-learning-path/selected-courses.facade';
import {AuthService} from '../../core/auth/auth.service';
import {LearningStoreService} from '../../core/state/learning-store.service';
import {ThemeService} from '../../core/theme/theme.service';
import type {CollectionLearningPathView, LearningPathExerciseView} from '../../domain/collection-learning-path/learning-path';
import {addDays, createFreshState, localDay} from '../../domain/learning/learning-rules';
import type {LearningState, LibraryCollection} from '../../domain/learning/models';
import {ShareStoryService} from '../share-story/share-story.service';
import {AppShellComponent} from './app-shell.component';

@Component({template: ''})
class EmptyPage {}

const bbcCourse: LibraryCollection = {
	id: 'bbc-six-minute-english',
	slug: 'bbc-six-minute-english',
	title: 'BBC 6 Minute English',
	kind: 'course',
	visibility: 'public',
	status: 'published',
	contentVersion: 1,
	wordCount: 0,
	subscribed: true,
};

const grammarCourse: LibraryCollection = {
	...bbcCourse,
	id: 'cambridge-grammar',
	slug: 'cambridge-grammar',
	title: 'Cambridge Grammar',
};

function progressExercise(id: string, state: LearningPathExerciseView['state']): LearningPathExerciseView {
	return {
		id,
		position: Number(id),
		type: 'vocabulary.quick-review',
		schemaVersion: 1,
		required: true,
		completionPolicy: 'fixture',
		config: {},
		state,
		progress: null,
	};
}

function progressView(collectionId: string): CollectionLearningPathView {
	return {
		access: {canProgress: true},
		resumePoint: null,
		path: {
			id: `${collectionId}-path`,
			collectionId,
			title: 'Fixture course',
			mode: 'finite',
			status: 'published',
			contentVersion: '1',
			learnerStatus: 'in_progress',
			progress: null,
		},
		lessons: [{
			id: 'lesson-1',
			title: 'Lesson 1',
			position: 1,
			sourceKind: null,
			sourceRef: null,
			state: 'in_progress',
			progress: null,
			exercises: [
				progressExercise('1', 'completed'),
				progressExercise('2', 'available'),
				progressExercise('3', 'available'),
				progressExercise('4', 'available'),
			],
		}],
	};
}

function fixtureState(): LearningState {
	const day = localDay();
	const state = createFreshState([
		{id: 'due', term: 'due', box: 1, due: day, introducedOn: day},
		{id: 'blocked', term: 'blocked', box: 1, due: day, blockedUntil: addDays(day, 1)},
		{id: 'future', term: 'future', box: 2, due: addDays(day, 1)},
		{id: 'mastered', term: 'mastered', box: 5, due: null, masteredAt: new Date().toISOString()},
		{id: 'unseen', term: 'unseen'},
	]);
	state.settings = {...state.settings, dailyNew: 0, theme: 'light'};
	state.daily[day] = {attempts: 1, correct: 1, wrong: 0, newAdded: 0, sessions: 1, durationSeconds: 10};
	return state;
}

describe('AppShell responsive navigation', () => {
	const state = signal<LearningState | null>(null);
	const selectedCourses = signal<LibraryCollection[]>([bbcCourse]);
	const learningPathView = signal<CollectionLearningPathView | null>(null);
	const coursesLoading = signal(false);
	const coursesError = signal('');
	const courseLoad = vi.fn(async () => true);
	const apply = vi.fn();
	const initialize = vi.fn(async () => state()!);
	const logout = vi.fn(async () => undefined);
	const update = vi.fn(async (mutator: (draft: LearningState) => void) => {
		const draft = structuredClone(state()!);
		mutator(draft);
		state.set(draft);
		return draft;
	});

	beforeEach(async () => {
		vi.clearAllMocks();
		initialize.mockReset();
		initialize.mockImplementation(async () => state()!);
		state.set(fixtureState());
		selectedCourses.set([bbcCourse]);
		learningPathView.set(null);
		coursesLoading.set(false);
		coursesError.set('');
		await TestBed.configureTestingModule({
			imports: [AppShellComponent],
			providers: [
				provideRouter([
					{path: 'dashboard', component: EmptyPage}, {path: 'settings', component: EmptyPage},
					{path: 'library/:id', component: EmptyPage}, {path: 'library/:collectionId/learning-path', component: EmptyPage},
					{path: 'reports', component: EmptyPage},
				]),
				{provide: AuthService, useValue: {user: signal({id: 'fixture', email: 'learner@example.test'}), logout}},
				{provide: LearningStoreService, useValue: {state, initialize, update}},
				{provide: ThemeService, useValue: {apply}},
				{provide: ShareStoryService, useValue: {open: vi.fn()}},
				{provide: CollectionLearningPathFacade, useValue: {view: learningPathView}},
				{provide: SelectedCoursesFacade, useValue: {courses: selectedCourses, loading: coursesLoading, error: coursesError, load: courseLoad}},
			],
		}).compileComponents();
	});

	async function render() {
		const fixture = TestBed.createComponent(AppShellComponent);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		return fixture;
	}

	it('keeps the dashboard single-purpose with no status strip or desktop stats rail', async () => {
		const fixture = await render();
		const host: HTMLElement = fixture.nativeElement;
		expect(host.querySelector('.topbar, .product-tabs')).toBeNull();
		expect(host.querySelectorAll('.sidebar-links a')).toHaveLength(7);
		expect(host.querySelectorAll('.mobile-nav a')).toHaveLength(5);
		expect(host.querySelectorAll('.mobile-nav button')).toHaveLength(1);
		expect(host.querySelector('.mobile-status')).toBeNull();
		expect(host.querySelector('[data-testid="desktop-right-rail"]')).toBeNull();
		expect(host.querySelector('.sidebar-summary')).toBeNull();
		expect(host.querySelector('.shell-workspace.is-dashboard')).not.toBeNull();
		expect(host.querySelectorAll('.mobile-nav svg')).toHaveLength(6);
	});

	it('keeps status chrome available away from the focused dashboard', async () => {
		const fixture = await render();
		await TestBed.inject(Router).navigateByUrl('/settings');
		fixture.detectChanges();
		const host: HTMLElement = fixture.nativeElement;
		const mobileItems = Array.from(host.querySelectorAll('.mobile-status .status-item'));
		const desktopItems = Array.from(host.querySelectorAll('[data-testid="desktop-right-rail"] .status-item'));
		expect(host.querySelector('[data-testid="desktop-workspace"]')).not.toBeNull();
		expect(host.querySelector('[data-testid="desktop-right-rail"]')).not.toBeNull();
		expect(mobileItems).toHaveLength(4);
		expect(desktopItems).toHaveLength(4);
		expect(desktopItems.map(item => item.getAttribute('title'))).toEqual(mobileItems.map(item => item.getAttribute('title')));
		expect(desktopItems.map(item => item.textContent?.trim())).toEqual(mobileItems.map(item => item.textContent?.trim()));
	});

	it('labels the mobile dock Home, Courses and Leitner in the requested order', async () => {
		const fixture = await render();
		const host: HTMLElement = fixture.nativeElement;
		const labels = Array.from(host.querySelectorAll('.mobile-nav .mobile-nav-label'))
			.map(item => item.textContent?.trim());
		expect(labels.slice(0, 3)).toEqual(['Home', 'Courses', 'Leitner']);
	});

	it('survives bootstrap failure and applies the stored theme after state recovers', async () => {
		state.set(null);
		initialize.mockRejectedValueOnce(new Error('temporarily offline'));
		const fixture = await render();
		expect(apply).not.toHaveBeenCalled();

		const recovered = fixtureState();
		recovered.settings.theme = 'dark';
		state.set(recovered);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(apply).toHaveBeenLastCalledWith('dark');
	});

	it('turns the course flag into the same course-menu trigger on mobile and desktop', async () => {
		const fixture = await render();
		await TestBed.inject(Router).navigateByUrl('/settings');
		fixture.detectChanges();
		const host: HTMLElement = fixture.nativeElement;
		expect(host.querySelector('[data-testid="mobile-course-trigger"]')).not.toBeNull();
		expect(host.querySelector('[data-testid="desktop-course-trigger"]')).not.toBeNull();
		expect(fixture.componentInstance.courses.courses().map(course => course.title)).toEqual(['BBC 6 Minute English']);
		expect(courseLoad).toHaveBeenCalledTimes(1);
	});

	it('tracks the current learning-path course and exposes its already-loaded progress only on that route', async () => {
		selectedCourses.set([bbcCourse, grammarCourse]);
		learningPathView.set(progressView('cambridge-grammar'));
		const fixture = await render();
		const router = TestBed.inject(Router);
		expect(fixture.componentInstance.activeCourseId()).toBe('bbc-six-minute-english');
		expect(fixture.componentInstance.currentCourseProgress()).toBeNull();

		await router.navigateByUrl('/library/cambridge-grammar/learning-path');
		fixture.detectChanges();
		expect(fixture.componentInstance.activeCourseId()).toBe('cambridge-grammar');
		expect(fixture.componentInstance.currentCourseProgress()?.percent).toBe(25);

		await router.navigateByUrl('/dashboard');
		fixture.detectChanges();
		expect(fixture.componentInstance.currentCourseProgress()).toBeNull();
	});

	it('keeps the BBC destination directly available instead of hiding it in overflow', async () => {
		const fixture = await render();
		expect(fixture.componentInstance.mobileNavItems.some(item => item.path === '/bbc-6-minute-english')).toBe(true);
		expect(fixture.nativeElement.querySelector('.mobile-nav a[aria-label="BBC 6 Minute English"]')).not.toBeNull();
	});

	it('derives honest counters without counting blocked, future, unseen or mastered words as due', async () => {
		const before = structuredClone(state());
		const fixture = await render();
		expect(fixture.componentInstance.stats()).toEqual({streak: 1, due: 1, mastered: 1});
		expect(state()).toEqual(before);
		expect(update).not.toHaveBeenCalled();
	});

	it('updates counters when canonical learner state changes', async () => {
		const fixture = await render();
		const next = fixtureState();
		next.words = [];
		next.daily = {};
		state.set(next);
		fixture.detectChanges();
		expect(fixture.componentInstance.stats()).toEqual({streak: 0, due: 0, mastered: 0});
	});

	it('uses a loading placeholder and compact visible counts without inventing progress', async () => {
		const fixture = await render();
		state.set(null);
		expect(fixture.componentInstance.stats()).toBeNull();
		expect(fixture.componentInstance.formatCount(undefined)).toBe('—');
		expect(fixture.componentInstance.formatCount(null)).toBe('—');
		expect(fixture.componentInstance.formatCount(0)).toBe('0');
		expect(fixture.componentInstance.formatCount(12345)).toBe('12.3K');
	});

	it('marks nested library routes current and mobile overflow routes active', async () => {
		const fixture = await render();
		const router = TestBed.inject(Router);
		await router.navigateByUrl('/library/fixture');
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.sidebar-links a[href="/library"]').getAttribute('aria-current')).toBe('page');
		expect(fixture.nativeElement.querySelector('.mobile-nav a[href="/library"]').getAttribute('aria-current')).toBe('page');
		expect(fixture.componentInstance.moreActive()).toBe(false);
		await router.navigateByUrl('/settings');
		expect(fixture.componentInstance.moreActive()).toBe(true);
	});

	it('preserves theme persistence through the existing learning store command', async () => {
		const fixture = await render();
		await fixture.componentInstance.cycleTheme();
		expect(update).toHaveBeenCalledTimes(1);
		expect(state()!.settings.theme).toBe('dark');
		expect(apply).toHaveBeenLastCalledWith('dark');
	});

	it('preserves sign-out through AuthService', async () => {
		const fixture = await render();
		await fixture.componentInstance.logout();
		expect(logout).toHaveBeenCalledTimes(1);
	});

	it('moves keyboard focus to main content without a fragment navigation', async () => {
		const fixture = await render();
		const event = new Event('click', {cancelable: true});
		fixture.componentInstance.skipToContent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(fixture.nativeElement.querySelector('main'));
	});
});
