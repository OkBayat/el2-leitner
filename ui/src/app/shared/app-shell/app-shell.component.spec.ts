import {Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AuthService} from '../../core/auth/auth.service';
import {LearningStoreService} from '../../core/state/learning-store.service';
import {ThemeService} from '../../core/theme/theme.service';
import {addDays, createFreshState, localDay} from '../../domain/learning/learning-rules';
import type {LearningState} from '../../domain/learning/models';
import {ShareStoryService} from '../share-story/share-story.service';
import {AppShellComponent} from './app-shell.component';

@Component({template: ''})
class EmptyPage {}

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
	const apply = vi.fn();
	const logout = vi.fn(async () => undefined);
	const update = vi.fn(async (mutator: (draft: LearningState) => void) => {
		const draft = structuredClone(state()!);
		mutator(draft);
		state.set(draft);
		return draft;
	});

	beforeEach(async () => {
		vi.clearAllMocks();
		state.set(fixtureState());
		await TestBed.configureTestingModule({
			imports: [AppShellComponent],
			providers: [
				provideRouter([
					{path: 'dashboard', component: EmptyPage}, {path: 'settings', component: EmptyPage},
					{path: 'library/:id', component: EmptyPage}, {path: 'reports', component: EmptyPage},
				]),
				{provide: AuthService, useValue: {user: signal({id: 'fixture', email: 'learner@example.test'}), logout}},
				{provide: LearningStoreService, useValue: {state, initialize: vi.fn(async () => state()!), update}},
				{provide: ThemeService, useValue: {apply}},
				{provide: ShareStoryService, useValue: {open: vi.fn()}},
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

	it('replaces desktop toolbar/tabs with seven sidebar destinations and a six-target mobile dock', async () => {
		const fixture = await render();
		const host: HTMLElement = fixture.nativeElement;
		expect(host.querySelector('.topbar, .product-tabs')).toBeNull();
		expect(host.querySelectorAll('.sidebar-links a')).toHaveLength(7);
		expect(host.querySelectorAll('.mobile-nav a')).toHaveLength(5);
		expect(host.querySelectorAll('.mobile-nav button')).toHaveLength(1);
		expect(host.querySelector('.mobile-status')).not.toBeNull();
		expect(host.querySelectorAll('.mobile-nav svg')).toHaveLength(6);
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
