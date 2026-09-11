import {DestroyRef, Injectable, isDevMode, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {catchError, filter, firstValueFrom, fromEvent, interval, merge, of, take, timeout} from 'rxjs';
import {isSecurePwaContext} from './pwa-platform';
import {Capacitor} from '@capacitor/core';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CONTROLLER_CHANGE_TIMEOUT_MS = 8_000;
const SUCCESSFUL_INSTALL_STATES = new Set<ServiceWorkerState>(['installed', 'activating', 'activated']);

export function isSuccessfulWorkerInstallState(state: ServiceWorkerState): boolean {
	return SUCCESSFUL_INSTALL_STATES.has(state);
}

export function isWorkerInstallFailure(state: ServiceWorkerState, installedSuccessfully: boolean): boolean {
	return state === 'redundant' && !installedSuccessfully;
}

@Injectable({providedIn: 'root'})
export class PwaUpdateService {
	private readonly destroyRef = inject(DestroyRef);
	private registration: ServiceWorkerRegistration | null = null;
	private waitingWorker: ServiceWorker | null = null;
	private started = false;

	readonly workerReady = signal(false);
	readonly updateReady = signal(false);
	readonly activating = signal(false);
	readonly errorMessage = signal('');

	start(): void {
		if (this.started) return;
		this.started = true;
		if (isDevMode() || Capacitor.isNativePlatform() || !this.canRegister()) return;
		void this.register();
	}

	async checkForUpdate(): Promise<boolean> {
		if (!this.registration || typeof document === 'undefined' || document.hidden) return false;
		try {
			await this.registration.update();
			return Boolean(this.registration.waiting || this.updateReady());
		} catch {
			return false;
		}
	}

	async reloadForUpdate(): Promise<void> {
		if (this.activating()) return;
		const worker = this.registration?.waiting || this.waitingWorker;
		if (!worker || typeof navigator === 'undefined') {
			globalThis.location?.reload();
			return;
		}

		this.activating.set(true);
		try {
			const controllerChanged = firstValueFrom(
				fromEvent(navigator.serviceWorker, 'controllerchange').pipe(
					take(1),
					timeout({first: CONTROLLER_CHANGE_TIMEOUT_MS}),
					catchError(() => of(null)),
				),
			);
			worker.postMessage({type: 'SKIP_WAITING'});
			await controllerChanged;
		} finally {
			globalThis.location?.reload();
		}
	}

	dismissUpdate(): void {
		this.updateReady.set(false);
	}

	clearError(): void {
		this.errorMessage.set('');
	}

	private canRegister(): boolean {
		if (typeof navigator === 'undefined' || !navigator.serviceWorker || typeof location === 'undefined') return false;
		return isSecurePwaContext(location, Boolean(globalThis.isSecureContext));
	}

	private async register(): Promise<void> {
		try {
			const registration = await navigator.serviceWorker.register('/service-worker.js', {
				scope: '/',
				updateViaCache: 'none',
			});
			this.registration = registration;
			this.workerReady.set(true);
			this.watchRegistration(registration);
			this.scheduleUpdateChecks();
			if (registration.waiting && navigator.serviceWorker.controller) {
				this.waitingWorker = registration.waiting;
				this.updateReady.set(true);
			}
		} catch {
			this.errorMessage.set('Vocora could not enable offline app support. Reload when you have a stable connection.');
		}
	}

	private watchRegistration(registration: ServiceWorkerRegistration): void {
		fromEvent(registration, 'updatefound')
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.watchInstallingWorker(registration.installing, registration));
		this.watchInstallingWorker(registration.installing, registration);
	}

	private watchInstallingWorker(
		worker: ServiceWorker | null,
		registration: ServiceWorkerRegistration,
	): void {
		if (!worker) return;
		let installedSuccessfully = isSuccessfulWorkerInstallState(worker.state);
		const handleState = () => {
			const state = worker.state;
			if (isSuccessfulWorkerInstallState(state)) {
				installedSuccessfully = true;
				this.errorMessage.set('');
			}
			if (state === 'installed' && navigator.serviceWorker.controller) {
				this.waitingWorker = registration.waiting || worker;
				this.updateReady.set(true);
			}
			if (isWorkerInstallFailure(state, installedSuccessfully)) {
				this.errorMessage.set('A Vocora update could not be installed. Keep this page open and try again online.');
			}
		};
		handleState();
		fromEvent(worker, 'statechange')
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(handleState);
	}

	private scheduleUpdateChecks(): void {
		if (typeof window === 'undefined' || typeof document === 'undefined') return;
		merge(
			fromEvent(window, 'online'),
			fromEvent(document, 'visibilitychange').pipe(filter(() => !document.hidden)),
			interval(UPDATE_CHECK_INTERVAL_MS),
		)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => void this.checkForUpdate());
	}
}
