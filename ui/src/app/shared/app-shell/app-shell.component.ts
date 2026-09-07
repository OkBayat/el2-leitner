import {ChangeDetectionStrategy, Component, ElementRef, HostListener, QueryList, ViewChild, ViewChildren, computed, inject, type OnInit} from '@angular/core';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {filter, map} from 'rxjs';
import {MatMenuModule, MatMenuTrigger} from '@angular/material/menu';
import {SelectedCoursesFacade} from '../../application/collection-learning-path/selected-courses.facade';
import {AuthService} from '../../core/auth/auth.service';
import {LearningStoreService} from '../../core/state/learning-store.service';
import {ThemeService} from '../../core/theme/theme.service';
import {calculateStreak, getDueWords, totalStats} from '../../domain/learning/learning-rules';
import {ShareStoryService} from '../share-story/share-story.service';
import {NavigationIconComponent, type NavigationIcon} from './navigation-icon.component';

interface NavigationItem {
	path: string;
	label: string;
	accessibleLabel: string;
	icon: NavigationIcon;
	mobile: boolean;
}

@Component({
	selector: 'app-shell',
	imports: [RouterOutlet, RouterLink, RouterLinkActive, MatMenuModule, NavigationIconComponent],
	templateUrl: 'app-shell.component.html',
	styleUrl: 'app-shell.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent implements OnInit {
	readonly auth = inject(AuthService);
	readonly store = inject(LearningStoreService);
	readonly share = inject(ShareStoryService);
	readonly courses = inject(SelectedCoursesFacade);
	private readonly theme = inject(ThemeService);
	private readonly router = inject(Router);
	private readonly currentUrl = toSignal(this.router.events.pipe(
		filter((event): event is NavigationEnd => event instanceof NavigationEnd),
		map(event => event.urlAfterRedirects),
	), {initialValue: this.router.url});
	private readonly countFormatter = new Intl.NumberFormat('en', {notation: 'compact', maximumFractionDigits: 1});

	@ViewChild('mainContent') private mainContent?: ElementRef<HTMLElement>;
	@ViewChildren(MatMenuTrigger) private menuTriggers?: QueryList<MatMenuTrigger>;

	readonly navItems = [
		{path: '/dashboard', label: 'Home', accessibleLabel: 'Home', icon: 'home', mobile: true},
		{path: '/bbc-6-minute-english', label: 'Listening', accessibleLabel: 'BBC 6 Minute English', icon: 'listening', mobile: true},
		{path: '/review', label: "Today's Review", accessibleLabel: "Today's Review", icon: 'review', mobile: true},
		{path: '/words', label: 'Words', accessibleLabel: 'Words', icon: 'words', mobile: true},
		{path: '/library', label: 'Library', accessibleLabel: 'Library', icon: 'library', mobile: true},
		{path: '/reports', label: 'Progress', accessibleLabel: 'Progress', icon: 'progress', mobile: false},
		{path: '/settings', label: 'Settings', accessibleLabel: 'Settings', icon: 'settings', mobile: false},
	] as const satisfies readonly NavigationItem[];
	readonly mobileNavItems = this.navItems.filter(item => item.mobile);
	readonly overflowNavItems = this.navItems.filter(item => !item.mobile);
	readonly moreActive = computed(() => {
		const path = this.currentUrl().split(/[?#]/u)[0];
		return ['/reports', '/settings', '/overview'].some(route => path === route || path.startsWith(`${route}/`));
	});
	readonly stats = computed(() => {
		const state = this.store.state();
		return state ? {
			streak: calculateStreak(state),
			due: getDueWords(state).length,
			mastered: totalStats(state).mastered,
		} : null;
	});

	async ngOnInit(): Promise<void> {
		void this.courses.load();
		const state = await this.store.initialize();
		this.theme.apply(state.settings.theme);
	}

	formatCount(value: number | null | undefined): string {
		return value == null ? '—' : this.countFormatter.format(value);
	}

	skipToContent(event: Event): void {
		event.preventDefault();
		this.mainContent?.nativeElement.focus({preventScroll: true});
	}

	@HostListener('window:resize')
	closeMenusOnResize(): void {
		// A menu must not remain anchored to a trigger hidden by a breakpoint change.
		this.menuTriggers?.forEach(trigger => trigger.closeMenu());
	}

	async logout(): Promise<void> {
		await this.auth.logout();
	}

	async cycleTheme(): Promise<void> {
		const order = {system: 'light', light: 'dark', dark: 'system'} as const;
		const state = await this.store.update((draft) => {
			draft.settings.theme = order[draft.settings.theme];
		});
		this.theme.apply(state.settings.theme);
	}
}
