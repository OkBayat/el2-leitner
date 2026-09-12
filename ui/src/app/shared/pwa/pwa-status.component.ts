import {ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {OverlayContainer} from '@angular/cdk/overlay';
import {NavigationEnd, Router} from '@angular/router';
import {filter} from 'rxjs';
import { VocoPrimaryButtonComponent, VocoSecondaryButtonComponent } from '../voco-button';
import {PwaConnectivityService} from '../../core/pwa/pwa-connectivity.service';
import {PwaInstallService} from '../../core/pwa/pwa-install.service';
import type {PwaInstallMode} from '../../core/pwa/pwa-platform';
import {PwaUpdateService} from '../../core/pwa/pwa-update.service';
import {RuntimePlatformService} from '../../core/platform/runtime-platform.service';
import {AppUpdateService} from '../../core/update/app-update.service';

const INSTALL_SUGGESTION_MODES = new Set<PwaInstallMode>([
	'prompt',
	'ios-safari',
	'ios-browser',
	'browser-menu',
]);
const REQUIRED_UPDATE_OVERLAY_CLASS = 'vocora-required-update-blocked';

export function synchronizeRequiredUpdateOverlay(container: HTMLElement, required: boolean): void {
	container.classList.toggle(REQUIRED_UPDATE_OVERLAY_CLASS, required);
	if (required) {
		container.setAttribute('inert', '');
		container.setAttribute('aria-hidden', 'true');
		return;
	}
	container.removeAttribute('inert');
	container.removeAttribute('aria-hidden');
}

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
	imports: [VocoPrimaryButtonComponent, VocoSecondaryButtonComponent],
	templateUrl: 'pwa-status.component.html',
	styleUrl: 'pwa-status.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaStatusComponent {
	private readonly destroyRef = inject(DestroyRef);
	private readonly router = inject(Router);
	private readonly overlayContainer = inject(OverlayContainer);
	private readonly routeUrl = signal(this.router.url);
	private readonly installDismissed = signal(false);
	private readonly requiredUpdateAction = viewChild<ElementRef<HTMLButtonElement>>('requiredUpdateAction');

	readonly connectivity = inject(PwaConnectivityService);
	readonly install = inject(PwaInstallService);
	readonly updates = inject(PwaUpdateService);
	readonly appUpdates = inject(AppUpdateService);
	readonly runtime = inject(RuntimePlatformService);
	readonly installing = signal(false);
	readonly showInstallSuggestion = computed(() => shouldShowPwaInstallSuggestion(
		this.routeUrl(),
		this.install.mode(),
		this.installDismissed(),
		this.updates.updateReady(),
		this.connectivity.online() && !this.runtime.native,
	));

	constructor() {
		effect(() => {
			const required = this.appUpdates.binaryUpdate() === 'required';
			synchronizeRequiredUpdateOverlay(this.overlayContainer.getContainerElement(), required);
			if (required) this.requiredUpdateAction()?.nativeElement.focus();
		});
		this.destroyRef.onDestroy(() => synchronizeRequiredUpdateOverlay(this.overlayContainer.getContainerElement(), false));
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
