import {DestroyRef, Injectable, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {fromEvent} from 'rxjs';

@Injectable({providedIn: 'root'})
export class PwaConnectivityService {
	private readonly destroyRef = inject(DestroyRef);
	private readonly onlineSignal = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
	readonly online = this.onlineSignal.asReadonly();

	constructor() {
		if (typeof window === 'undefined') return;
		fromEvent(window, 'online')
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.onlineSignal.set(true));
		fromEvent(window, 'offline')
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.onlineSignal.set(false));
	}
}
