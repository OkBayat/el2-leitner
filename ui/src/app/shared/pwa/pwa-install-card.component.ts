import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import { VocoButtonComponent } from '../voco-button';
import {MatCardModule} from '@angular/material/card';
import {PwaInstallService} from '../../core/pwa/pwa-install.service';

@Component({
	selector: 'app-pwa-install-card',
	imports: [VocoButtonComponent, MatCardModule],
	template: `
		<mat-card class="install-card" appearance="outlined" data-testid="pwa-install-card">
			<mat-card-header>
				<div class="install-icon" mat-card-avatar aria-hidden="true">＋</div>
				<mat-card-title>Install Vocora</mat-card-title>
				<mat-card-subtitle>Use it from your Home Screen like a phone app.</mat-card-subtitle>
			</mat-card-header>

			<mat-card-content aria-live="polite">
				@switch (install.mode()) {
					@case ('installed') {
						<p class="state-message success"><strong>Installed on this device</strong><span>Vocora is already running as a standalone web app.</span></p>
					}
					@case ('prompt') {
						<p class="state-message"><strong>Ready to install</strong><span>The browser has verified the app and can add it to this device now.</span></p>
					}
					@case ('ios-safari') {
						<p class="state-message"><strong>Install from Safari</strong><span>Apple uses the Share menu instead of an automatic install prompt.</span></p>
						<ol>
							<li>Tap the <b>Share</b> button in Safari.</li>
							<li>Choose <b>Add to Home Screen</b>.</li>
							<li>Turn on <b>Open as Web App</b>, then tap <b>Add</b>.</li>
						</ol>
					}
					@case ('ios-browser') {
						<p class="state-message"><strong>Open this page in Safari</strong><span>Then use Share → Add to Home Screen → Open as Web App → Add.</span></p>
					}
					@case ('browser-menu') {
						<p class="state-message"><strong>Install from the browser menu</strong><span>Choose <b>Install app</b> or <b>Add to Home screen</b>. The direct Install button appears automatically when the browser offers it.</span></p>
					}
					@case ('insecure') {
						<p class="state-message warning"><strong>HTTPS is required</strong><span>Open Vocora through its secure HTTPS address before installing it.</span></p>
					}
					@default {
						<p class="state-message warning"><strong>Installation is not supported here</strong><span>Use a current version of Safari, Chrome, Edge, or Samsung Internet.</span></p>
					}
				}

				@if (install.lastOutcome() === 'dismissed') {
					<p class="install-result">Installation was dismissed. You can install later from the browser menu.</p>
				} @else if (install.lastOutcome() === 'failed') {
					<p class="install-result error">The install prompt could not be completed. Reload and try again.</p>
				}

				<p class="privacy-note">The app shell and static learning interface are cached on this device. Account data and saved progress continue to come from Vocora's server.</p>
			</mat-card-content>

			@if (install.mode() === 'prompt') {
				<mat-card-actions>
					<voco-primary-button
						type="button"
						data-testid="install-vocora"
						[disabled]="installing()"
						(click)="requestInstall()"
					>
						{{ installing() ? 'Opening installer…' : 'Install on this device' }}
					</voco-primary-button>
				</mat-card-actions>
			}
		</mat-card>
	`,
	styles: [`
		:host{display:block}
		.install-card{height:100%;padding:18px}
		.install-icon{display:grid;place-items:center;border-radius:12px;background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container);font-size:24px;font-weight:500}
		mat-card-content{padding-top:18px}
		.state-message{display:grid;gap:4px;margin:0;padding:14px;border-radius:14px;background:var(--mat-sys-surface-container-low)}
		.state-message strong{font-size:14px}
		.state-message span{color:var(--mat-sys-on-surface-variant);font-size:12px;line-height:1.5}
		.state-message.success{background:var(--mat-sys-primary-container);color:var(--mat-sys-on-primary-container)}
		.state-message.success span{color:inherit;opacity:.82}
		.state-message.warning{background:var(--mat-sys-error-container);color:var(--mat-sys-on-error-container)}
		.state-message.warning span{color:inherit;opacity:.82}
		ol{display:grid;gap:8px;margin:14px 0 0;padding-left:22px;color:var(--mat-sys-on-surface-variant);font-size:12px;line-height:1.45}
		.install-result{margin:12px 0 0;color:var(--mat-sys-on-surface-variant);font-size:12px}
		.install-result.error{color:var(--mat-sys-error)}
		.privacy-note{margin:16px 0 0;color:var(--mat-sys-on-surface-variant);font-size:11px;line-height:1.5}
		mat-card-actions{padding:4px 16px 16px}
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaInstallCardComponent {
	readonly install = inject(PwaInstallService);
	readonly installing = signal(false);

	async requestInstall(): Promise<void> {
		if (this.installing()) return;
		this.installing.set(true);
		try {
			await this.install.install();
		} finally {
			this.installing.set(false);
		}
	}
}
