import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ReviewAnswerSoundService } from '../../../../../core/sound/review-answer-sound.service';
import { SpeechService } from '../../../../../core/speech/speech.service';
import { LearningStoreService } from '../../../../../core/state/learning-store.service';
import { DictationSlideComponent } from './dictation-slide.component';

function configure(): {
	play: ReturnType<typeof vi.fn>;
	stop: ReturnType<typeof vi.fn>;
} {
	const answerSound = { play: vi.fn(), stop: vi.fn() };
	TestBed.configureTestingModule({
		providers: [
			{ provide: ReviewAnswerSoundService, useValue: answerSound },
			{
				provide: SpeechService,
				useValue: { speak: vi.fn(), cancel: vi.fn() },
			},
			{
				provide: LearningStoreService,
				useValue: { state: signal({ settings: { voiceRate: 0.9 } }) },
			},
		],
	});
	return answerSound;
}

function load(component: DictationSlideComponent): void {
	component.load({
		slideId: 'dictation-remediation',
		type: 'dictation',
		data: {
			audio: '/audio/december.mp3',
			answer: 'december',
			definition: 'the twelfth month of the year',
		},
	});
}

describe('dictation slide remediation', () => {
	it('stays on the current slide until final recall succeeds', () => {
		const answerSound = configure();
		const component = TestBed.runInInjectionContext(() => new DictationSlideComponent());
		const states: unknown[] = [];
		const events: unknown[] = [];
		component.stateChange.subscribe((state) => states.push(state));
		component.event.subscribe((event) => events.push(event));
		load(component);

		component.setAnswer('desmber');
		component.handleAction('check');
		expect(component.remediation()?.phase).toBe('correction');
		expect(component.showAnswerInput()).toBe(false);
		expect(states.at(-1)).toMatchObject({
			chrome: {
				footer: {
					tone: 'error',
					detail: 'the twelfth month of the year',
					primary: { id: 'continue', behavior: 'content' },
				},
			},
		});

		component.handleAction('continue');
		expect(component.remediation()?.phase).toBe('recall');
		expect(component.showAnswerInput()).toBe(true);
		expect(component.answerLabel()).toBe('Recall from memory');
		expect(states.at(-1)).toMatchObject({
			chrome: {
				footer: {
					tone: 'neutral',
					title: 'From memory',
					primary: { id: 'check', behavior: 'content', disabled: true },
				},
			},
		});

		component.setAnswer('decembr');
		component.handleAction('check');
		expect(component.remediation()?.phase).toBe('copy');
		expect(component.showComparison()).toBe(true);
		expect(component.answerLabel()).toBe('Exact copy');
		expect(answerSound.play).toHaveBeenLastCalledWith('incorrect');

		component.setAnswer('decemberr');
		component.handleAction('check');
		expect(component.remediation()?.phase).toBe('copy');
		expect(component.remediation()?.copyFailures).toBe(1);
		expect(answerSound.play).toHaveBeenLastCalledWith('incorrect');

		component.setAnswer('december');
		component.handleAction('check');
		expect(component.remediation()?.phase).toBe('recall');
		expect(component.showComparison()).toBe(false);
		expect(answerSound.play).toHaveBeenLastCalledWith('correct');

		component.setAnswer('december');
		component.handleAction('check');
		expect(component.remediation()?.phase).toBe('completed');
		expect(states.at(-1)).toMatchObject({
			chrome: {
				footer: {
					tone: 'success',
					title: 'Nice!',
					primary: { id: 'continue', behavior: 'next' },
				},
			},
		});
		expect(answerSound.play).toHaveBeenLastCalledWith('correct');
		expect(events).toHaveLength(1);

		component.ngOnDestroy();
	});

	it('renders correction, recall, and copy like the review screen', async () => {
		configure();
		const fixture = TestBed.createComponent(DictationSlideComponent);
		const component = fixture.componentInstance;
		load(component);
		fixture.detectChanges();

		component.setAnswer('desmber');
		component.handleAction('check');
		fixture.detectChanges();
		let element = fixture.nativeElement as HTMLElement;
		expect(element.querySelector('textarea')).toBeNull();
		expect(element.querySelector('[data-testid="correct-spelling"]')?.textContent).toContain(
			'december',
		);
		expect(element.querySelector('[data-testid="user-spelling"]')?.textContent).toContain(
			'desmber',
		);
		expect(
			element.querySelector('[data-testid="dictation-remediation-badge"]')?.textContent,
		).toContain('SPELLING CORRECTION');

		component.handleAction('continue');
		fixture.detectChanges();
		element = fixture.nativeElement as HTMLElement;
		expect(element.querySelector('.spelling-comparison')).toBeNull();
		expect(element.querySelector('mat-label')?.textContent).toContain('Recall from memory');
		expect(
			element.querySelector('textarea')?.getAttribute('placeholder'),
		).toBeNull();
		expect(
			element.querySelector('[data-testid="dictation-remediation-badge"]')?.textContent,
		).toContain('RECALL FROM MEMORY');
		await vi.waitFor(() =>
			expect(document.activeElement).toBe(element.querySelector('textarea')),
		);

		component.setAnswer('decembr');
		component.handleAction('check');
		fixture.detectChanges();
		element = fixture.nativeElement as HTMLElement;
		expect(element.querySelector('textarea')).not.toBeNull();
		expect(element.querySelector('.spelling-comparison')).not.toBeNull();
		expect(element.querySelector('mat-label')?.textContent).toContain('Exact copy');
		expect(
			element.querySelector('textarea')?.getAttribute('placeholder'),
		).toBeNull();
		expect(
			element.querySelector('[data-testid="dictation-remediation-badge"]')?.textContent,
		).toContain('COPY THE CORRECTION');
	});
});
