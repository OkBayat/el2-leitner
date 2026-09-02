import {DestroyRef, Injectable, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {fromEvent} from 'rxjs';
import {
	isStandaloneApp,
	resolvePwaInstallMode,
	type PwaInstallMode,
	type PwaLocationSnapshot,
	type PwaNavigatorSnapshot,
} from './pwa-platform';

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'failed' | 'unavailable';

interface BeforeInstallPromptChoice {
	outcome: 'accepted' | 'dismissed';
	platform?: string;
}

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	readonly userChoice: Promise<BeforeInstallPromptChoice>;
}

@Injectable({providedIn: 'root'})
export class PwaInstallService {
	private readonly destroyRef = inject(DestroyRef);
	private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
	private readonly displayModeStandalone = signal(false);
	private readonly installedSignal = signal(false);
	private readonly navigatorSnapshot: PwaNavigatorSnapshot;
	private readonly locationSnapshot: PwaLocationSnapshot;
	private readonly secureContext: boolean;

	readonly lastOutcome = signal<PwaInstallOutcome | null>(null);
	readonly installed = this.installedSignal.asReadonly();
	readonly promptAvailable = computed(() => Boolean(this.deferredPrompt()));
	readonly mode = computed<PwaInstallMode>(() => resolvePwaInstallMode({
		installed: this.installedSignal(),
		promptAvailable: this.promptAvailable(),
		navigator: this.navigatorSnapshot,
		location: this.locationSnapshot,
		secureContext: this.secureContext,
	}));

	constructor() {
		const browserNavigator = typeof navigator === 'undefined' ? undefined : navigator;
		const browserLocation = typeof location === 'undefined' ? undefined : location;
		this.navigatorSnapshot = {
			userAgent: browserNavigator?.userAgent,
			platform: browserNavigator?.platform,
			maxTouchPoints: browserNavigator?.maxTouchPoints,
			standalone: (browserNavigator as Navigator & {standalone?: boolean} | undefined)?.standalone,
			serviceWorker: browserNavigator?.serviceWorker,
		};
		this.locationSnapshot = {
			protocol: browserLocation?.protocol,
			hostname: browserLocation?.hostname,
		};
		this.secureContext = Boolean(globalThis.isSecureContext);

		if (typeof window === 'undefined') return;
		const displayMode = window.matchMedia('(display-mode: standalone)');
		this.displayModeStandalone.set(displayMode.matches);
		this.installedSignal.set(isStandaloneApp(this.navigatorSnapshot, displayMode.matches));

		fromEvent<MediaQueryListEvent>(displayMode, 'change')
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((event) => {
				this.displayModeStandalone.set(event.matches);
				this.installedSignal.set(isStandaloneApp(this.navigatorSnapshot, event.matches));
			});

		fromEvent<BeforeInstallPromptEvent>(window, 'beforeinstallprompt')
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((event) => {
				event.preventDefault();
				this.deferredPrompt.set(event);
				this.lastOutcome.set(null);
			});

		fromEvent<Event>(window, 'appinstalled')
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => {
				this.deferredPrompt.set(null);
				this.installedSignal.set(true);
				this.lastOutcome.set('accepted');
			});
	}

	async install(): Promise<PwaInstallOutcome> {
		const prompt = this.deferredPrompt();
		if (!prompt) {
			this.lastOutcome.set('unavailable');
			return 'unavailable';
		}

		this.deferredPrompt.set(null);
		this.lastOutcome.set(null);
		try {
			await prompt.prompt();
			const choice = await prompt.userChoice;
			this.lastOutcome.set(choice.outcome);
			if (choice.outcome === 'accepted') this.installedSignal.set(true);
			return choice.outcome;
		} catch {
			this.lastOutcome.set('failed');
			return 'failed';
		}
	}
}
