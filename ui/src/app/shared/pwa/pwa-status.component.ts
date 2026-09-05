import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs';
import {PwaConnectivityService} from '../../core/pwa/pwa-connectivity.service';
import {PwaInstallService} from '../../core/pwa/pwa-install.service';
import type {PwaInstallMode} from '../../core/pwa/pwa-platform';
import {PwaUpdateService} from '../../core/pwa/pwa-update.service';

const INSTALL_SUGGESTION_MODES = new Set<PwaInstallMode>([
	'prompt',
	'ios-safari',
	'ios-browser',
	'browser-menu',
]);

export function shouldShowPwaInstallSuggestion(
	routeUrl: string,
	mode: PwaInstallMode,
	dismissed: boolean,
	updateReady: boolean,
	online: boolean,
): boolean {
	const path = routeUrl.split(/[?#]/u, 1)[0].replace(/\/+$/u, '') || '/';
	const isDashboard = path === '/' || path === '/dashboard';
	return isDashboard && online && !dismissed && !updateReady && INSTALL_SUGGESTION_MODES.has(mode);
}

@Component({
	selector: 'app-pwa-status',
	template: `
		<section class="pwa-status-stack" aria-live="polite" aria-atomic="true">
			@if (!connectivity.online()) {
				<div class="pwa-status offline" role="status" data-testid="offline-status">
					<span class="status-mark" aria-hidden="true">!</span>
					<div>
						<strong>You're offline</strong>
						<small>Vocora will reconnect automatically. Account changes need an internet connection.</small>
					</div>
				</div>
			}

			@if (updates.updateReady()) {
				<div class="pwa-status update" role="status" data-testid="pwa-update-ready">
					<span class="status-mark" aria-hidden="true">↻</span>
					<div>
						<strong>A new Vocora version is ready</strong>
						<small>Reload once to switch to the updated app files.</small>
					</div>
					<div class="status-actions">
						<button type="button" (click)="updates.dismissUpdate()">Later</button>
						<button class="primary" type="button" [disabled]="updates.activating()" (click)="updates.reloadForUpdate()">
							{{ updates.activating() ? 'Updating…' : 'Reload' }}
						</button>
					</div>
				</div>
			}

			@if (showInstallSuggestion()) {
				<div class="pwa-status install" role="status" data-testid="pwa-install-suggestion">
					<span class="status-mark" aria-hidden="true">＋</span>
					<div>
						<strong>Install Vocora on this device</strong>
						@switch (install.mode()) {
							@case ('prompt') {
								<small>Add Vocora to your device for quicker access and a standalone app experience.</small>
							}
							@case ('ios-safari') {
								<small>In Safari, tap Share → Add to Home Screen → Open as Web App → Add.</small>
							}
							@case ('ios-browser') {
								<small>Open Vocora in Safari, then use Share → Add to Home Screen.</small>
							}
							@default {
								<small>Open your browser menu and choose Install app or Add to Home screen.</small>
							}
						}
					</div>
					<div class="status-actions">
						<button type="button" (click)="dismissInstall()">Later</button>
						@if (install.mode() === 'prompt') {
							<button class="primary" type="button" [disabled]="installing()" (click)="requestInstall()">
								{{ installing() ? 'Opening…' : 'Install' }}
							</button>
						}
					</div>
				</div>
			}

			@if (updates.errorMessage()) {
				<div class="pwa-status error" role="alert" data-testid="pwa-update-error">
					<span class="status-mark" aria-hidden="true">!</span>
					<div>
						<strong>App support needs attention</strong>
						<small>{{ updates.errorMessage() }}</small>
					</div>
					<button type="button" (click)="updates.clearError()">Dismiss</button>
				</div>
			}
		</section>
	`,
	styles: [`
		:host{position:relative;z-index:1000}
		.pwa-status-stack{position:fixed;z-index:1000;top:max(12px,var(--safe-area-top));left:50%;display:grid;width:min(620px,calc(100% - max(24px,calc(var(--safe-area-left) + var(--safe-area-right) + 16px))));gap:8px;pointer-events:none;transform:translateX(-50%)}
		.pwa-status{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--mat-sys-outline-variant);border-radius:16px;background:color-mix(in srgb,var(--mat-sys-surface-container-high) 96%,transparent);color:var(--mat-sys-on-surface);box-shadow:var(--mat-sys-level3);backdrop-filter:blur(14px);pointer-events:auto}
		.pwa-status.offline{grid-template-columns:auto minmax(0,1fr)}
		.status-mark{display:grid;width:32px;height:32px;place-items:center;border-radius:50%;background:var(--mat-sys-secondary-container);color:var(--mat-sys-on-secondary-container);font-weight:800}
		.pwa-status.install .status-mark{background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container)}
		.pwa-status.error .status-mark{background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container)}
		.pwa-status strong,.pwa-status small{display:block}
		.pwa-status strong{font-size:13px;font-weight:700}
		.pwa-status small{margin-top:2px;color:var(--mat-sys-on-surface-variant);font-size:11px;line-height:1.4}
		.status-actions{display:flex;gap:6px}
		button{min-height:34px;padding:0 11px;border:0;border-radius:999px;background:transparent;color:var(--mat-sys-primary);font:inherit;font-size:11px;font-weight:700;cursor:pointer}
		button:hover{background:var(--mat-sys-surface-container-highest)}
		button.primary{background:var(--mat-sys-primary);color:var(--mat-sys-on-primary)}
		button:disabled{opacity:.55;cursor:wait}
		@media(max-width:560px){.pwa-status{grid-template-columns:auto minmax(0,1fr);align-items:start}.status-actions,.pwa-status>button{grid-column:2;justify-self:start}.status-actions{margin-top:2px}}
		@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaStatusComponent {
	private readonly destroyRef = inject(DestroyRef);
	private readonly router = inject(Router);
	private readonly routeUrl = signal(this.router.url);
	private readonly installDismissed = signal(false);

	readonly connectivity = inject(PwaConnectivityService);
	readonly install = inject(PwaInstallService);
	readonly updates = inject(PwaUpdateService);
	readonly installing = signal(false);
	readonly showInstallSuggestion = computed(() => shouldShowPwaInstallSuggestion(
		this.routeUrl(),
		this.install.mode(),
		this.installDismissed(),
		this.updates.updateReady(),
		this.connectivity.online(),
	));

	constructor() {
		this.router.events
			.pipe(
				filter((event): event is NavigationEnd => event instanceof NavigationEnd),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe((event) => this.routeUrl.set(event.urlAfterRedirects));
	}

	dismissInstall(): void {
		this.installDismissed.set(true);
	}

	async requestInstall(): Promise<void> {
		if (this.installing()) return;
		this.installing.set(true);
		try {
			const outcome = await this.install.install();
			if (outcome === 'dismissed') this.installDismissed.set(true);
		} finally {
			this.installing.set(false);
		}
	}
}
