import {ChangeDetectionStrategy, Component, OnInit, computed, inject} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';
import {MatMenuModule} from '@angular/material/menu';
import {AuthService} from '../../core/auth/auth.service';
import {LearningStoreService} from '../../core/state/learning-store.service';
import {ThemeService} from '../../core/theme/theme.service';
import {calculateStreak} from '../../domain/learning/learning-rules';
import {ShareStoryService} from '../share-story/share-story.service';

@Component({
	selector: 'app-shell',
	imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatMenuModule],
	templateUrl: 'app-shell.component.html',
	styleUrl: 'app-shell.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent implements OnInit {
	readonly auth = inject(AuthService);
	readonly store = inject(LearningStoreService);
	readonly share = inject(ShareStoryService);
	private readonly theme = inject(ThemeService);
	readonly navItems = [
		{path: '/dashboard', label: 'Home', symbol: '⌂'},
		{path: '/review', label: "Today's Review", symbol: '◷'},
		{path: '/words', label: 'Words', symbol: '▤'},
		{path: '/library', label: 'Library', symbol: '▦'},
		{path: '/reports', label: 'Progress', symbol: '↗'},
		{path: '/settings', label: 'Settings', symbol: '⚙'},
	] as const;
	readonly primaryNavItems = this.navItems.filter((item) => item.path !== '/settings');
	readonly streak = computed(() => this.store.state() ? calculateStreak(this.store.state()!) : 0);
	readonly userInitials = computed(() => {
		const email = this.auth.user()?.email || 'Vocora';
		const localPart = email.split('@')[0].replace(/[^a-z0-9]+/giu, ' ').trim();
		const words = localPart.split(/\s+/u).filter(Boolean);
		if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
		return localPart.slice(0, 2).toUpperCase() || 'VO';
	});

	async ngOnInit(): Promise<void> {
		const state = await this.store.initialize();
		this.theme.apply(state.settings.theme);
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
