import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import { VocoButtonComponent } from '../../shared/voco-button';
import {AuthService} from '../../core/auth/auth.service';

@Component({
	selector: 'app-offline-page',
	imports: [VocoButtonComponent],
	template: `
		<main class="offline-page" data-testid="offline-page">
			<section class="offline-card">
				<img src="/assets/icons/icon-192.png" width="76" height="76" alt="">
				<p class="eyebrow">Vocora is installed and ready</p>
				<h1>You're offline</h1>
				<p>The app interface is available, but signing in and loading account progress require an internet connection.</p>
				@if (stillOffline()) {
					<p class="connection-note" role="status">No connection yet. Check Wi-Fi or mobile data, then try again.</p>
				}
				<voco-primary-button
					type="button"
					[disabled]="retrying()"
					(click)="retry()"
				>
					{{ retrying() ? 'Checking connection…' : 'Try again' }}
				</voco-primary-button>
			</section>
		</main>
	`,
	styles: [`
		:host{display:block;min-height:100dvh;background:var(--mat-sys-surface)}
		.offline-page{display:grid;min-height:100dvh;place-items:center;padding:max(24px,var(--safe-area-top)) max(18px,var(--safe-area-right)) max(24px,var(--safe-area-bottom)) max(18px,var(--safe-area-left))}
		.offline-card{display:grid;width:min(460px,100%);justify-items:start;padding:32px;border:1px solid var(--mat-sys-outline-variant);border-radius:28px;background:var(--mat-sys-surface-container-low);box-shadow:var(--mat-sys-level2)}
		img{display:block;border-radius:20px}
		.eyebrow{margin:22px 0 8px;color:var(--mat-sys-primary);font-size:12px;font-weight:700}
		h1{margin:0;font-size:clamp(34px,8vw,52px);font-weight:500;letter-spacing:-.04em}
		.offline-card>p:not(.eyebrow):not(.connection-note){margin:12px 0 24px;color:var(--mat-sys-on-surface-variant);font-size:14px;line-height:1.6}
		.connection-note{margin:0 0 16px;padding:10px 12px;border-radius:12px;background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container);font-size:12px}
		button{min-height:46px}
		@media(max-width:520px){.offline-card{padding:26px 22px;border-radius:22px}}
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflinePageComponent {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly auth = inject(AuthService);
	private readonly returnTo = this.auth.safeReturnTo(this.route.snapshot.queryParamMap.get('returnTo'));
	readonly retrying = signal(false);
	readonly stillOffline = signal(false);

	async retry(): Promise<void> {
		if (this.retrying()) return;
		this.stillOffline.set(false);
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			this.stillOffline.set(true);
			return;
		}
		this.retrying.set(true);
		try {
			await this.router.navigateByUrl(this.returnTo);
		} finally {
			this.retrying.set(false);
		}
	}
}
