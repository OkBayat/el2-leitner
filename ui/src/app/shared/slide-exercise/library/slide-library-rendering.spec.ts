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
import {
	ClassificationSlideComponent,
	ClozeSlideComponent,
	MatchingSlideComponent,
	TeachingCardSlideComponent,
} from './slide-library.components';

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
			if (type === 'cloze') {
				const clozeInput = (
					fixture.nativeElement as HTMLElement
				).querySelector('textarea.cloze-input');
				expect(clozeInput).not.toBeNull();
				expect(clozeInput?.classList).not.toContain(
					'mat-mdc-input-element',
				);
				expect(clozeInput?.closest('mat-form-field')).toBeNull();
				expect(clozeInput?.getAttribute('rows')).toBe('1');
				for (const [name, value] of Object.entries({
					autocomplete: 'off',
					autocapitalize: 'none',
					autocorrect: 'off',
					spellcheck: 'false',
				})) {
					expect(clozeInput?.getAttribute(name)).toBe(value);
				}
				expect(
					(fixture.nativeElement as HTMLElement).querySelector(
						'input.cloze-input',
					),
				).toBeNull();
				expect(
					(fixture.nativeElement as HTMLElement).querySelector(
						'.cloze-input-measure',
					),
				).not.toBeNull();
				expect(
					(fixture.nativeElement as HTMLElement).textContent,
				).toContain('ONE WORD ONLY');
				expect(
					(fixture.nativeElement as HTMLElement).textContent,
				).toContain('NO MORE THAN 2 WORDS');
			}
			fixture.destroy();
		}
	});

	it('renders TeachingCard guidance before its learning blocks', () => {
		const fixture = TestBed.createComponent(TeachingCardSlideComponent);
		fixture.componentInstance.load({
			slideId: 'teaching-clarity',
			type: 'teaching-card',
			data: {
				instruction: 'Understand the pattern before you practise.',
				title: 'Store relationships as chunks',
				explanation:
					'Learn the whole phrase so you can choose a natural combination.',
				blocks: [
					{
						kind: 'patterns',
						title: 'Verbs',
						content: 'Use establish for creating a relationship.',
					},
				],
			},
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		expect(element.querySelector('.teaching-card__lead')?.textContent).toContain(
			'Learn the whole phrase',
		);
		expect(element.querySelector('.teaching-grid')?.textContent).toContain(
			'Use establish for creating a relationship.',
		);
	});

	it('renders constrained TeachingCard markdown without allowing raw HTML', () => {
		const fixture = TestBed.createComponent(TeachingCardSlideComponent);
		fixture.componentInstance.load({
			slideId: 'teaching-markdown',
			type: 'teaching-card',
			data: {
				mode: 'rule',
				instruction: 'Learn the pattern.',
				title: 'Present simple',
				markdown: [
					'### Form',
					'Use **does not** with *he, she,* and *it*.',
					'The main verb stays in the base form.',
					'',
					'#### Steps',
					'1. Choose the subject.',
					'2. Choose do or does.',
					'',
					'- I do not work.',
					'- She does not work.',
					'',
					'<img src=x onerror=alert(1)>',
				].join('\n'),
			},
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		const markdown = element.querySelector('.teaching-markdown');
		expect(markdown?.querySelector('h3')?.textContent).toBe('Form');
		expect(markdown?.querySelector('h4')?.textContent).toBe('Steps');
		expect(markdown?.querySelector('strong')?.textContent).toBe('does not');
		expect(markdown?.querySelector('strong')?.classList).toContain(
			'teaching-markdown__known',
		);
		expect(markdown?.querySelectorAll('em')).toHaveLength(2);
		expect(markdown?.querySelectorAll('ol li')).toHaveLength(2);
		expect(markdown?.querySelectorAll('ul li')).toHaveLength(2);
		expect(markdown?.querySelector('p br')).not.toBeNull();
		expect(markdown?.querySelector('img')).toBeNull();
		expect(markdown?.textContent).toContain('<img src=x onerror=alert(1)>');
	});

	it('exposes MatchingSlide and ClassificationSlide interaction states accessibly', () => {
		const matchingFixture = TestBed.createComponent(MatchingSlideComponent);
		matchingFixture.componentInstance.load({
			slideId: 'matching-accessibility',
			type: 'matching',
			data: {
				pairs: [
					{ id: 'make', left: 'make', right: 'a decision' },
					{ id: 'take', left: 'take', right: 'a risk' },
				],
			},
		});
		matchingFixture.componentInstance.selectLeft('make');
		matchingFixture.detectChanges();
		const selectedMatch = (
			matchingFixture.nativeElement as HTMLElement
		).querySelector('[aria-pressed="true"]');
		expect(selectedMatch?.getAttribute('aria-label')).toContain('selected');

		const classificationFixture = TestBed.createComponent(
			ClassificationSlideComponent,
		);
		classificationFixture.componentInstance.load({
			slideId: 'classification-accessibility',
			type: 'classification',
			data: {
				categories: [
					{ id: 'animal', label: 'Animal' },
					{ id: 'plant', label: 'Plant' },
				],
				items: [
					{ id: 'paw', label: 'paw', correctCategoryId: 'animal' },
				],
			},
		});
		classificationFixture.componentInstance.selectItem('paw');
		classificationFixture.componentInstance.assignSelected('plant');
		classificationFixture.componentInstance.handleAction('check');
		classificationFixture.detectChanges();
		const classifiedItem = (
			classificationFixture.nativeElement as HTMLElement
		).querySelector('.chip-list button');
		const classificationBucket = (
			classificationFixture.nativeElement as HTMLElement
		).querySelector('.bucket');
		expect(classificationBucket?.tagName).toBe('DIV');
		expect(
			(classificationFixture.nativeElement as HTMLElement).querySelector(
				'button.bucket',
			),
		).toBeNull();
		expect(classifiedItem?.getAttribute('aria-label')).toContain(
			'incorrect; correct category Animal',
		);

		matchingFixture.destroy();
		classificationFixture.destroy();
	});

	it('renders select-mode ClozeSlide answers as numbered choice cards', () => {
		const fixture = TestBed.createComponent(ClozeSlideComponent);
		fixture.componentInstance.load({
			slideId: 'select-cloze',
			type: 'cloze',
			data: {
				content: 'If it gets worse, they {{result}}.',
				inputMode: 'select',
				wordBank: [
					'will live forever',
					'will be happy',
					"won't do well",
				],
				blanks: [{ id: 'result', answers: ["won't do well"] }],
			},
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		expect(element.querySelector('mat-select')).toBeNull();
		expect(element.querySelector('textarea.cloze-input')).toBeNull();
		expect(
			element
				.querySelector('.cloze-choice-blank')
				?.getAttribute('aria-pressed'),
		).toBe('false');
		const choices = element.querySelectorAll(
			'.cloze-choice-grid .choice-option',
		);
		expect(choices).toHaveLength(3);
		expect(
			choices[0]?.querySelector('.choice-option__number')?.textContent,
		).toContain('1');

		(choices[2] as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(choices[2]?.getAttribute('data-state')).toBe('selected');
		expect(choices[2]?.getAttribute('aria-checked')).toBe('true');
		expect(
			element
				.querySelector('.cloze-choice-blank')
				?.getAttribute('aria-pressed'),
		).toBe('true');
		expect(
			element.querySelector('.cloze-choice-blank')?.textContent,
		).toContain("won't do well");
		fixture.destroy();
	});

	it('keeps free-text cloze answers single-line when text is pasted', () => {
		const fixture = TestBed.createComponent(ClozeSlideComponent);
		fixture.componentInstance.load({
			slideId: 'text-cloze',
			type: 'cloze',
			data: {
				content: 'Use {{source}} today.',
				blanks: [{ id: 'source', answers: ['renewable energy'] }],
			},
		});
		fixture.detectChanges();

		const textarea = (fixture.nativeElement as HTMLElement).querySelector(
			'textarea.cloze-input',
		) as HTMLTextAreaElement;
		textarea.value = 'renewable\nenergy';
		textarea.dispatchEvent(new Event('input'));

		expect(fixture.componentInstance.answers()['source']).toBe('renewable energy');
	});

	it('reveals free-text cloze answer options below the sentence', () => {
		const fixture = TestBed.createComponent(ClozeSlideComponent);
		fixture.componentInstance.load({
			slideId: 'text-cloze-options',
			type: 'cloze',
			data: {
				content: '{{first}} power reduces {{second}}.',
				blanks: [
					{ id: 'first', answers: ['Renewable'] },
					{ id: 'second', answers: ['emissions'] },
				],
			},
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		expect(element.querySelector('.cloze-answer-options')).toBeNull();
		(
			element.querySelector(
				'.cloze-answer-support button',
			) as HTMLButtonElement
		).click();
		fixture.detectChanges();

		expect(
			element.querySelector('.cloze-answer-options')?.textContent,
		).toContain('emissions');
		expect(
			element.querySelector('.cloze-answer-options')?.textContent,
		).toContain('Renewable');
	});

	it('opens vocabulary details from an answered free-text cloze field', async () => {
		const fixture = TestBed.createComponent(ClozeSlideComponent);
		fixture.componentInstance.load({
			slideId: 'cloze-vocabulary-details',
			type: 'cloze',
			data: {
				content:
					'The players were exultant after the final {{whistle}}.',
				blanks: [
					{
						id: 'whistle',
						answers: ['whistle'],
						definitions: [
							'a small device that makes a high sound when air passes through it',
						],
					},
				],
			},
		});
		fixture.componentInstance.setAnswer('whistle', 'whistel');
		fixture.componentInstance.handleAction('check');
		fixture.detectChanges();

		const textarea = (fixture.nativeElement as HTMLElement).querySelector(
			'textarea.cloze-input',
		) as HTMLTextAreaElement;
		expect(textarea.readOnly).toBe(true);
		expect(textarea.disabled).toBe(false);
		textarea.click();
		fixture.detectChanges();
		await fixture.whenStable();

		const details = document.body.querySelector(
			'[data-testid="cloze-word-details"]',
		);
		expect(details?.textContent).toContain(
			'The players were exultant after the final whistle.',
		);
		expect(details?.textContent).not.toContain('whistel');
		expect(details?.textContent).toContain(
			'a small device that makes a high sound',
		);
		fixture.destroy();
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
		const random = vi.spyOn(Math, 'random').mockReturnValue(0.999);
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
		random.mockRestore();

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
