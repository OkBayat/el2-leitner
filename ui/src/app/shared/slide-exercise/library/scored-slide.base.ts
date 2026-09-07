import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { SlideContentEvent } from '../slide-content-contracts';
import type { SlideExerciseRuntimeState } from '../slide-exercise.models';
import type { SlideInteractionState } from './slide-library.models';

export abstract class ScoredSlideBase<TData> {
	protected slideId = '';
	protected readonly stateChanges = new Subject<SlideExerciseRuntimeState>();
	protected readonly events = new Subject<SlideContentEvent>();
	readonly stateChange = this.stateChanges.asObservable();
	readonly event = this.events.asObservable();
	readonly content = signal<TData | null>(null);
	readonly interactionState = signal<SlideInteractionState>('idle');

	protected begin(slideId: string, data: TData, actionId = 'check'): void {
		this.slideId = slideId;
		this.content.set(data);
		this.interactionState.set('idle');
		this.stateChanges.next({
			chrome: {
				footer: {
					tone: 'neutral',
					title: '',
					detail: '',
					primary: {
						id: actionId,
						label: actionId === 'submit' ? 'Submit' : 'Check',
						behavior: 'content',
						disabled: true,
					},
				},
			},
		});
	}

	protected setReady(ready: boolean, actionId = 'check'): void {
		if (this.interactionState() !== 'idle') return;
		this.stateChanges.next({
			chrome: {
				footer: {
					primary: {
						id: actionId,
						label: actionId === 'submit' ? 'Submit' : 'Check',
						behavior: 'content',
						disabled: !ready,
					},
				},
			},
		});
	}

	protected finish(correct: boolean, data: unknown, explanation = ''): void {
		this.interactionState.set(
			correct ? 'answered-correct' : 'answered-incorrect',
		);
		this.stateChanges.next({
			chrome: {
				footer: {
					tone: correct ? 'success' : 'error',
					title: correct ? 'Correct' : 'Not quite',
					detail: explanation,
					primary: {
						id: 'continue',
						label: 'Continue',
						behavior: 'next',
						disabled: false,
					},
				},
			},
		});
		this.events.next({ type: 'answered', data });
	}

	protected submit(data: unknown, detail = ''): void {
		this.interactionState.set('revealed');
		this.stateChanges.next({
			chrome: {
				footer: {
					tone: 'success',
					title: 'Response saved',
					detail,
					primary: {
						id: 'continue',
						label: 'Continue',
						behavior: 'next',
						disabled: false,
					},
				},
			},
		});
		this.events.next({ type: 'submitted', data });
	}

	protected data(): TData {
		const value = this.content();
		if (!value) throw new Error('Slide has not been loaded.');
		return value;
	}

	destroy(): void {
		this.stateChanges.complete();
		this.events.complete();
	}
}
