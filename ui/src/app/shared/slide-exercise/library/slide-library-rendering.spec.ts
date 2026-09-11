import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ReviewAnswerSoundService } from '../../../core/sound/review-answer-sound.service';
import { SpeechService } from '../../../core/speech/speech.service';
import { LearningStoreService } from '../../../core/state/learning-store.service';
import { createDefaultSlideContentRegistry } from '../slide-content-registry';
import { SlideExerciseComponent } from '../slide-exercise.component';
import type { SlideExerciseRuntimeState } from '../slide-exercise.models';
import { REUSABLE_SLIDE_FIXTURES } from './slide-library.fixtures';
import { REUSABLE_SLIDE_TYPES } from './slide-library.models';
import {
	ClassificationSlideComponent,
	ClozeSlideComponent,
	DictationSlideComponent,
	MatchingSlideComponent,
	PronunciationSlideComponent,
	TeachingCardSlideComponent,
} from './slide-library.components';

describe('reusable slide renderer contract', () => {
	it('renders dictation playback controls and a soft single-line answer field', () => {
		const speech = { speak: vi.fn().mockReturnValue(true), cancel: vi.fn() };
		TestBed.configureTestingModule({
			providers: [
				{ provide: SpeechService, useValue: speech },
				{
					provide: LearningStoreService,
					useValue: { state: signal({ settings: { voiceRate: 0.9 } }) },
				},
			],
		});
		const fixture = TestBed.createComponent(DictationSlideComponent);
		fixture.componentInstance.load({
			slideId: 'dictation-controls',
			type: 'dictation',
			data: {
				speech: { text: 'renewable energy', replay: true },
				answer: 'renewable energy',
				maxReplays: 2,
			},
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		const normal = element.querySelector<HTMLButtonElement>(
			'[data-testid="dictation-play-normal"]',
		);
		const slow = element.querySelector<HTMLButtonElement>(
			'[data-testid="dictation-play-slow"]',
		);
		expect(normal?.getAttribute('aria-label')).toBe(
			'Play dictation pronunciation',
		);
		expect(slow?.getAttribute('aria-label')).toBe(
			'Play dictation pronunciation slowly',
		);
		expect(normal?.querySelector('img')?.getAttribute('src')).toBe(
			'/assets/icons/normal-speed.svg',
		);
		expect(slow?.querySelector('img')?.getAttribute('src')).toBe(
			'/assets/icons/slow-speed.svg',
		);
		expect(normal?.querySelector('svg')).toBeNull();
		expect(slow?.querySelector('svg')).toBeNull();

		const answerField = element.querySelector('mat-form-field');
		const answer = answerField?.querySelector('textarea');
		expect(document.activeElement).toBe(answer);
		expect(answerField?.classList).not.toContain('vocora-form-field--soft');
		expect(answerField?.classList).not.toContain('vocora-form-field--raised');
		expect(answerField?.querySelector('input')).toBeNull();
		expect(answerField?.querySelector('mat-label')?.textContent).toContain(
			'Your answer',
		);
		expect(answer?.classList).not.toContain('dictation-answer-input');
		expect(answer?.getAttribute('placeholder')).toBeNull();
		expect(answer?.getAttribute('aria-label')).toBe('Your answer');
		for (const [name, value] of Object.entries({
			autocomplete: 'off',
			lang: 'en',
			'aria-multiline': 'false',
			enterkeyhint: 'go',
			wrap: 'off',
			rows: '1',
			autocapitalize: 'off',
			autocorrect: 'off',
			spellcheck: 'false',
		})) {
			expect(answer?.getAttribute(name)).toBe(value);
		}
		expect(normal?.getAttribute('aria-keyshortcuts')).toBe('Alt+R');
		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'r',
				altKey: true,
				bubbles: true,
				cancelable: true,
			}),
		);
		slow?.click();
		expect(speech.speak).toHaveBeenNthCalledWith(1, 'renewable energy', 0.9);
		expect(speech.speak).toHaveBeenNthCalledWith(
			2,
			'renewable energy',
			0.9,
			undefined,
			undefined,
			'slow',
		);
		fixture.detectChanges();
		expect(normal?.disabled).toBe(true);
		expect(slow?.disabled).toBe(true);

		fixture.destroy();
		expect(speech.cancel).toHaveBeenCalledOnce();
	});

	it('renders the same normal and slow controls for audio-backed dictation', () => {
		TestBed.configureTestingModule({
			providers: [
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
		const fixture = TestBed.createComponent(DictationSlideComponent);
		fixture.componentInstance.load({
			slideId: 'audio-dictation-controls',
			type: 'dictation',
			data: {
				audio: '/audio/example.mp3',
				answer: 'environment',
				maxReplays: 1,
			},
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		const normal = element.querySelector<HTMLButtonElement>(
			'[data-testid="slide-audio-play-normal"]',
		);
		const slow = element.querySelector<HTMLButtonElement>(
			'[data-testid="slide-audio-play-slow"]',
		);
		expect(normal?.getAttribute('aria-label')).toBe('Play dictation audio');
		expect(slow?.getAttribute('aria-label')).toBe(
			'Play dictation audio slowly',
		);
		expect(normal?.getAttribute('aria-keyshortcuts')).toBe('Alt+R');
		expect(normal?.querySelector('img')?.getAttribute('src')).toBe(
			'/assets/icons/normal-speed.svg',
		);
		expect(slow?.querySelector('img')?.getAttribute('src')).toBe(
			'/assets/icons/slow-speed.svg',
		);

		const audio = element.querySelector('audio')!;
		audio.play = vi.fn().mockResolvedValue(undefined);
		slow?.click();
		fixture.detectChanges();

		expect(audio.playbackRate).toBe(0.85);
		expect(audio.preservesPitch).toBe(true);
		expect(normal?.disabled).toBe(true);
		expect(slow?.disabled).toBe(true);
		fixture.destroy();
	});

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
					'Use the **base verb** with *I, you, we,* and *they*. Add **-s** or **-es** with *he, she,* and *it*.',
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
		expect(markdown?.querySelector('strong')?.textContent).toBe('base verb');
		expect(markdown?.querySelector('strong')?.classList).toContain(
			'teaching-markdown__known',
		);
		expect([...markdown?.querySelectorAll('strong') ?? []].map((element) => element.textContent)).toEqual([
			'base verb',
			'-s',
			'-es',
		]);
		expect(markdown?.textContent).not.toContain('known">');
		expect(markdown?.querySelectorAll('em')).toHaveLength(4);
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
		classificationFixture.detectChanges();
		const classificationElement =
			classificationFixture.nativeElement as HTMLElement;
		const classificationRegions = classificationElement.querySelectorAll(
			'.bucket-grid, .chip-list',
		);
		expect(classificationRegions[0]?.classList).toContain('bucket-grid');
		expect(classificationRegions[1]?.classList).toContain('chip-list');
		expect(classificationElement.querySelector('.chip-list')?.classList).toContain(
			'cdk-drop-list',
		);
		const sourceItem = classificationElement.querySelector<HTMLButtonElement>(
			'.chip-list [data-item-id="paw"]',
		);
		expect(sourceItem?.classList).toContain('classification-item');
		expect(
			classificationElement.querySelectorAll('.bucket.cdk-drop-list'),
		).toHaveLength(2);

		classificationFixture.componentInstance.assignDropped('paw', 'plant');
		classificationFixture.detectChanges();
		expect(
			classificationElement.querySelector('.chip-list [data-item-id="paw"]'),
		).toBeNull();
		let classifiedItem = classificationElement.querySelector<HTMLButtonElement>(
			'[data-category-id="plant"] [data-item-id="paw"]',
		);
		expect(classifiedItem?.className).toBe(sourceItem?.className);

		classificationFixture.componentInstance.assignDropped('paw', 'animal');
		classificationFixture.detectChanges();
		expect(
			classificationElement.querySelector(
				'[data-category-id="plant"] [data-item-id="paw"]',
			),
		).toBeNull();
		classifiedItem = classificationElement.querySelector<HTMLButtonElement>(
			'[data-category-id="animal"] [data-item-id="paw"]',
		);
		expect(classifiedItem).not.toBeNull();

		classificationFixture.componentInstance.assignDropped('paw', 'plant');
		classificationFixture.componentInstance.handleAction('check');
		classificationFixture.detectChanges();
		classifiedItem = classificationElement.querySelector<HTMLButtonElement>(
			'[data-category-id="plant"] [data-item-id="paw"]',
		);
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
		expect(classifiedItem?.dataset['state']).toBe('incorrect');

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
		expect(document.activeElement).toBe(textarea);
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

	it('can hide free-text answer options and stacks the stimulus below the instruction', () => {
		const fixture = TestBed.createComponent(ClozeSlideComponent);
		fixture.componentInstance.load({
			slideId: 'text-cloze-hidden-options',
			type: 'cloze',
			data: {
				instruction: 'Listen and complete the sentence.',
				stimulus: {
					type: 'dialogue',
					turns: [{ speaker: 'Sentence', text: 'Use renewable energy today.' }],
				},
				content: 'Use {{source}} today.',
				showOptions: false,
				blanks: [{ id: 'source', answers: ['renewable energy'] }],
			},
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		const instruction = element.querySelector('.slide-instruction');
		expect(element.querySelector('.cloze-answer-support')).toBeNull();
		expect(element.querySelector('.slide-type > app-slide-stimulus')).toBeNull();
		expect(instruction?.nextElementSibling?.tagName).toBe(
			'APP-SLIDE-STIMULUS',
		);
	});

	it('renders ClozeSlide sentence replay and reveals spoken words in order', () => {
		const speech = { speak: vi.fn().mockReturnValue(true), cancel: vi.fn() };
		TestBed.configureTestingModule({
			providers: [
				{ provide: SpeechService, useValue: speech },
				{
					provide: LearningStoreService,
					useValue: { state: signal({ settings: { voiceRate: 0.9 } }) },
				},
			],
		});
		const fixture = TestBed.createComponent(ClozeSlideComponent);
		fixture.componentInstance.load({
			slideId: 'spoken-cloze',
			type: 'cloze',
			data: {
				content: 'Use {{source}} today.',
				speech: { text: 'Use renewable energy today.' },
				blanks: [{ id: 'source', answers: ['renewable energy'] }],
			},
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		const button = element.querySelector<HTMLButtonElement>(
			'[data-testid="cloze-sentence-replay"]',
		);
		expect(element.querySelector('app-slide-stimulus')).toBeNull();
		expect(button?.hasAttribute('mat-icon-button')).toBe(true);
		expect(button?.getAttribute('aria-keyshortcuts')).toBe('Alt+R');
		expect(button?.classList).not.toContain('vocora-secondary-icon-action');
		expect(button?.querySelector('.cloze-sentence-replay__icon')).not.toBeNull();
		const sentence = element.querySelector('.cloze-content');
		expect(sentence?.firstElementChild).toBe(button);
		expect(getComputedStyle(button as HTMLButtonElement).display).toBe(
			'inline-block',
		);
		const replayIcon = button?.querySelector<HTMLElement>(
			'.cloze-sentence-replay__icon',
		);
		expect(getComputedStyle(replayIcon as HTMLElement).position).toBe(
			'absolute',
		);
		expect(getComputedStyle(replayIcon as HTMLElement).inset).toBe(
			'50% auto auto 50%',
		);

		const spokenWords = element.querySelectorAll(
			'.cloze-playback-token--word',
		);
		const blank = element.querySelector('.inline-field--text');
		expect(spokenWords[0]?.classList).not.toContain('is-spoken');
		expect(blank?.classList).not.toContain('is-spoken');

		const observer = speech.speak.mock.calls[0][2] as {
			onWordBoundary: (charIndex: number) => void;
			onEnd: () => void;
		};
		observer.onWordBoundary(0);
		fixture.detectChanges();
		expect(spokenWords[0]?.classList).toContain('is-spoken');
		expect(blank?.classList).not.toContain('is-spoken');

		observer.onWordBoundary(4);
		fixture.detectChanges();
		expect(blank?.classList).toContain('is-spoken');
		observer.onEnd();
		fixture.detectChanges();
		expect(spokenWords[spokenWords.length - 1]?.classList).toContain(
			'is-spoken',
		);

		button?.click();
		expect(speech.speak).toHaveBeenCalledTimes(2);
	});

	it('renders repeat pronunciation with inline playback and automatic recording states', () => {
		let observer: { onWordBoundary: (charIndex: number) => void; onEnd: () => void } | undefined;
		const speech = {
			speak: vi.fn().mockImplementation(
				(_text: string, _rate: number, playbackObserver: typeof observer) => {
					observer = playbackObserver;
					return true;
				},
			),
			cancel: vi.fn(),
		};
		const phase = signal<'ready' | 'recording' | 'feedback'>('ready');
		const result = signal<{
			words: readonly { text: string; matched: boolean }[];
			transcript: string;
			matchedCount: number;
			totalCount: number;
			score: number;
			passed: boolean;
		} | null>(null);
		const practice = {
			supported: true,
			phase,
			levels: signal<readonly number[]>([4, 12, 24, 8]),
			seconds: signal(1.4),
			assessment: signal<{
				words: readonly { text: string; matched: boolean }[];
				transcript: string;
				matchedCount: number;
				totalCount: number;
				score: number;
				passed: boolean;
			} | null>(null),
			result,
			error: signal(''),
			selectPrompt: vi.fn().mockReturnValue(true),
			record: vi.fn().mockResolvedValue(undefined),
			stop: vi.fn().mockResolvedValue(undefined),
			pause: vi.fn(),
		};
		TestBed.configureTestingModule({
			providers: [
				{ provide: SpeechService, useValue: speech },
				{
					provide: LearningStoreService,
					useValue: { state: signal({ settings: { voiceRate: 0.9 } }) },
				},
			],
		});
		const fixture = TestBed.createComponent(PronunciationSlideComponent);
		const states: SlideExerciseRuntimeState[] = [];
		fixture.componentInstance.stateChange.subscribe((state) => states.push(state));
		fixture.componentInstance.load({
			slideId: 'repeat-sentence',
			type: 'pronunciation',
			data: {
				mode: 'repeat',
				instruction: 'Listen and repeat.',
				question: 'The meeting is on Thursday.',
				speech: { text: 'The meeting is on Thursday.' },
				recording: { itemId: 'word-1', promptId: 'sentence-1' },
			},
			environment: { pronunciationPractice: practice },
		});
		fixture.detectChanges();

		const element = fixture.nativeElement as HTMLElement;
		const sentence = element.querySelector('.pronunciation-sentence');
		const replay = element.querySelector<HTMLButtonElement>('[data-testid="pronunciation-sentence-replay"]');
		const recordButton = element.querySelector<HTMLButtonElement>('[data-testid="pronunciation-record"]');
		expect(element.querySelector('app-slide-stimulus')).toBeNull();
		expect(sentence?.firstElementChild).toBe(replay);
		expect(replay?.hasAttribute('mat-icon-button')).toBe(true);
		expect(replay?.getAttribute('aria-keyshortcuts')).toBe('Alt+R');
		expect(element.querySelectorAll('.cloze-playback-token--word')).toHaveLength(5);
		expect(recordButton?.textContent).toContain('Tap to speak');

		observer?.onWordBoundary(0);
		fixture.detectChanges();
		expect(element.querySelector('.cloze-playback-token--word')?.classList).toContain('is-spoken');
		observer?.onEnd();
		expect(practice.record).toHaveBeenCalledOnce();

		phase.set('recording');
		practice.assessment.set({
			words: [
				{ text: 'The', matched: true },
				{ text: 'meeting', matched: false },
				{ text: 'is', matched: false },
				{ text: 'on', matched: false },
				{ text: 'Thursday', matched: false },
			],
			transcript: 'the',
			matchedCount: 1,
			totalCount: 5,
			score: 20,
			passed: false,
		});
		fixture.detectChanges();
		expect(recordButton?.getAttribute('aria-pressed')).toBe('true');
		expect(element.querySelectorAll('.pronunciation-waveform span')).toHaveLength(4);
		expect(recordButton?.textContent).toContain('Listening · 1.4s');
		const recognizedWords = element.querySelectorAll('.cloze-playback-token--word.is-recognized');
		expect(recognizedWords).toHaveLength(1);
		expect(recognizedWords[0]?.textContent).toBe('The');
		practice.assessment.set({
			words: [
				{ text: 'The', matched: false },
				{ text: 'meeting', matched: true },
				{ text: 'is', matched: false },
				{ text: 'on', matched: false },
				{ text: 'Thursday', matched: false },
			],
			transcript: 'meeting',
			matchedCount: 1,
			totalCount: 5,
			score: 20,
			passed: false,
		});
		fixture.detectChanges();
		expect(element.querySelectorAll('.cloze-playback-token--word.is-recognized')).toHaveLength(2);

		const answered = vi.fn();
		fixture.componentInstance.event.subscribe(answered);
		phase.set('feedback');
		result.set({
			words: [
				{ text: 'The', matched: true },
				{ text: 'meeting', matched: false },
				{ text: 'is', matched: false },
				{ text: 'on', matched: false },
				{ text: 'Thursday', matched: false },
			],
			transcript: 'The',
			matchedCount: 1,
			totalCount: 5,
			score: 20,
			passed: false,
		});
		fixture.detectChanges();
		expect(element.querySelectorAll('.cloze-playback-token--word.is-recognized')).toHaveLength(2);
		expect(states.at(-1)).toMatchObject({
			chrome: {
				footer: {
					detail: '2 of 5 words recognized · 40%',
				},
			},
		});

		result.set({
			words: [
				{ text: 'The', matched: true },
				{ text: 'meeting', matched: true },
				{ text: 'is', matched: true },
				{ text: 'on', matched: true },
				{ text: 'Thursday', matched: true },
			],
			transcript: 'The meeting is on Thursday.',
			matchedCount: 5,
			totalCount: 5,
			score: 100,
			passed: true,
		});
		fixture.detectChanges();
		expect(fixture.componentInstance.interactionState()).toBe('answered-correct');
		expect(answered).toHaveBeenCalledWith(expect.objectContaining({ type: 'answered' }));
	});

	it('offers three warning retries before final pronunciation failure', () => {
		const speech = { speak: vi.fn().mockReturnValue(true), cancel: vi.fn() };
		const phase = signal<'ready' | 'feedback'>('ready');
		const result = signal<{
			words: readonly { text: string; matched: boolean }[];
			transcript: string;
			matchedCount: number;
			totalCount: number;
			score: number;
			passed: boolean;
		} | null>(null);
		const practice = {
			supported: true,
			phase,
			levels: signal<readonly number[]>(Array(4).fill(4)),
			seconds: signal(0),
			assessment: signal(null),
			result,
			error: signal(''),
			selectPrompt: vi.fn().mockReturnValue(true),
			record: vi.fn().mockResolvedValue(undefined),
			stop: vi.fn().mockResolvedValue(undefined),
			pause: vi.fn(),
		};
		TestBed.configureTestingModule({
			providers: [
				{ provide: SpeechService, useValue: speech },
				{ provide: LearningStoreService, useValue: { state: signal({ settings: { voiceRate: 0.9 } }) } },
			],
		});
		const fixture = TestBed.createComponent(PronunciationSlideComponent);
		const states: Array<{ chrome?: { footer?: { tone?: string; title?: string; primary?: { id?: string; label?: string } | false } } }> = [];
		fixture.componentInstance.stateChange.subscribe((state) => states.push(state));
		fixture.componentInstance.load({
			slideId: 'repeat-sentence',
			type: 'pronunciation',
			data: {
				mode: 'repeat',
				question: 'Try this sentence.',
				speech: { text: 'Try this sentence.' },
				recording: { itemId: 'word-1', promptId: 'sentence-1' },
			},
			environment: { pronunciationPractice: practice },
		});
		fixture.detectChanges();

		for (let attempt = 1; attempt <= 3; attempt += 1) {
			phase.set('feedback');
			result.set({
				words: [{ text: 'Try', matched: false }],
				transcript: '', matchedCount: 0, totalCount: 3, score: 0, passed: false,
			});
			fixture.detectChanges();
			expect(fixture.componentInstance.interactionState()).toBe('idle');
			expect(states.at(-1)?.chrome?.footer).toMatchObject({
				tone: 'warning',
				title: 'Try again',
				primary: { id: 'retry-pronunciation', label: 'Try again' },
			});
		}

		fixture.componentInstance.handleAction('retry-pronunciation');
		expect(practice.record).toHaveBeenCalledOnce();
		(fixture.nativeElement as HTMLElement)
			.querySelector<HTMLButtonElement>('[data-testid="pronunciation-record"]')
			?.click();
		expect(practice.record).toHaveBeenCalledTimes(2);

		result.set({
			words: [{ text: 'Try', matched: false }],
			transcript: '', matchedCount: 0, totalCount: 3, score: 0, passed: false,
		});
		fixture.detectChanges();
		expect(fixture.componentInstance.interactionState()).toBe('answered-incorrect');
		expect(states.at(-1)?.chrome?.footer?.tone).toBe('error');
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
