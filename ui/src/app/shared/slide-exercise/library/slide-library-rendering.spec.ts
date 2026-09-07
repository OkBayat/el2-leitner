import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ReviewAnswerSoundService } from '../../../core/sound/review-answer-sound.service';
import { SpeechService } from '../../../core/speech/speech.service';
import { LearningStoreService } from '../../../core/state/learning-store.service';
import { createDefaultSlideContentRegistry } from '../slide-content-registry';
import { SlideExerciseComponent } from '../slide-exercise.component';
import { REUSABLE_SLIDE_FIXTURES } from './slide-library.fixtures';
import { REUSABLE_SLIDE_TYPES } from './slide-library.models';

describe('reusable slide renderer contract', () => {
	it('constructs and renders every registered reusable slide type from configuration', async () => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: ReviewAnswerSoundService,
					useValue: { play: vi.fn(), stop: vi.fn() },
				},
				{
					provide: SpeechService,
					useValue: { speak: vi.fn(), cancel: vi.fn() },
				},
				{
					provide: LearningStoreService,
					useValue: { state: signal(null) },
				},
			],
		});
		const registry = createDefaultSlideContentRegistry();

		for (const type of REUSABLE_SLIDE_TYPES) {
			const slide = REUSABLE_SLIDE_FIXTURES.find(
				(candidate) => candidate.type === type,
			);
			const renderer = registry.resolve(type);
			expect(slide, `fixture for ${type}`).toBeDefined();
			expect(renderer, `renderer for ${type}`).toBeDefined();
			const component = await renderer!.loadComponent();
			const fixture = TestBed.createComponent(component);
			fixture.componentInstance.load({
				slideId: slide!.id,
				type,
				data: slide!.data,
			});
			fixture.detectChanges();
			expect(
				(fixture.nativeElement as HTMLElement).textContent?.trim(),
				`rendered content for ${type}`,
			).not.toBe('');
			fixture.destroy();
		}
	});

	it('routes number keys and Enter through the shared shell for ChoiceSlide', async () => {
		TestBed.configureTestingModule({
			imports: [SlideExerciseComponent],
			providers: [
				{
					provide: ReviewAnswerSoundService,
					useValue: { play: vi.fn(), stop: vi.fn() },
				},
				{
					provide: SpeechService,
					useValue: { speak: vi.fn(), cancel: vi.fn() },
				},
				{
					provide: LearningStoreService,
					useValue: { state: signal(null) },
				},
			],
		});
		const fixture = TestBed.createComponent(SlideExerciseComponent);
		const slide = REUSABLE_SLIDE_FIXTURES.find(
			(candidate) => candidate.type === 'choice',
		)!;
		fixture.componentRef.setInput('slides', [slide]);
		fixture.detectChanges();
		await vi.waitFor(() => {
			fixture.detectChanges();
			expect(
				(fixture.nativeElement as HTMLElement).querySelector(
					'[data-testid="choice-slide"]',
				),
			).not.toBeNull();
		});

		const preventNumber = vi.fn();
		fixture.componentInstance.handleKeyboard({
			key: '1',
			preventDefault: preventNumber,
		} as unknown as KeyboardEvent);
		fixture.detectChanges();
		expect(
			(fixture.nativeElement as HTMLElement).querySelector(
				'[data-state="selected"]',
			)?.textContent,
		).toContain('enviroment');

		const preventEnter = vi.fn();
		fixture.componentInstance.handleKeyboard({
			key: 'Enter',
			preventDefault: preventEnter,
		} as unknown as KeyboardEvent);
		fixture.detectChanges();
		expect(preventEnter).toHaveBeenCalledOnce();
		expect(
			(fixture.nativeElement as HTMLElement).querySelector(
				'[data-state="incorrect"]',
			)?.textContent,
		).toContain('enviroment');
		expect(
			(fixture.nativeElement as HTMLElement).querySelector(
				'[data-state="correct"]',
			)?.textContent,
		).toContain('environment');
		expect(
			(fixture.nativeElement as HTMLElement)
				.querySelector('[data-state="incorrect"]')
				?.getAttribute('aria-label'),
		).toContain('your answer, incorrect');
		expect(
			(fixture.nativeElement as HTMLElement)
				.querySelector('[data-state="correct"]')
				?.getAttribute('aria-label'),
		).toContain('correct answer');
		expect((fixture.nativeElement as HTMLElement).textContent).toContain(
			'Correct answer: environment',
		);
		fixture.destroy();
	});

	it('captures the initial Submit action for a model-only RewriteSlide', async () => {
		TestBed.configureTestingModule({ imports: [SlideExerciseComponent] });
		const fixture = TestBed.createComponent(SlideExerciseComponent);
		fixture.componentRef.setInput('slides', [
			{
				id: 'rewrite-model',
				type: 'rewrite',
				data: {
					original: 'People use less energy now.',
					modelAnswer: 'Less energy is used now.',
				},
			},
		]);
		fixture.detectChanges();
		await vi.waitFor(() => {
			fixture.detectChanges();
			expect(
				fixture.componentInstance.presentation?.footer.primary?.label,
			).toBe('Submit');
		});

		const textarea = (fixture.nativeElement as HTMLElement).querySelector(
			'textarea',
		) as HTMLTextAreaElement;
		textarea.value = 'Energy use has fallen.';
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(
			fixture.componentInstance.presentation?.footer.primary,
		).toMatchObject({
			id: 'submit',
			disabled: false,
		});
		fixture.destroy();
	});
});
