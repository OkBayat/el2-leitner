import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ReviewAnswerSoundService } from '../../../core/sound/review-answer-sound.service';
import { SpeechService } from '../../../core/speech/speech.service';
import { LearningStoreService } from '../../../core/state/learning-store.service';
import { LocalAudioRecorderService } from './local-audio-recorder.service';
import { SlideAudioControlComponent } from './slide-audio-control.component';
import {
	ChoiceSlideComponent,
	ClassificationSlideComponent,
	ClozeSlideComponent,
	DictationSlideComponent,
	ErrorCorrectionSlideComponent,
	MatchingSlideComponent,
	RewriteSlideComponent,
	SelectionSlideComponent,
	ShortAnswerSlideComponent,
	SpeakingResponseSlideComponent,
	StructuredCompletionSlideComponent,
	WordFormationSlideComponent,
	WritingResponseSlideComponent,
} from './slide-library.components';

function load(
	component: {
		load(context: { slideId: string; type: string; data: unknown }): void;
	},
	type: string,
	data: unknown,
): void {
	component.load({ slideId: 'slide-1', type, data });
}

function configure(): {
	speak: ReturnType<typeof vi.fn>;
	cancel: ReturnType<typeof vi.fn>;
} {
	const speech = { speak: vi.fn().mockReturnValue(true), cancel: vi.fn() };
	TestBed.configureTestingModule({
		providers: [
			{
				provide: ReviewAnswerSoundService,
				useValue: { play: vi.fn(), stop: vi.fn() },
			},
			{
				provide: LocalAudioRecorderService,
				useValue: {
					supported: () => true,
					start: vi.fn().mockResolvedValue(undefined),
					stop: vi.fn().mockResolvedValue('blob:recording'),
					cancel: vi.fn(),
				},
			},
			{ provide: SpeechService, useValue: speech },
			{
				provide: LearningStoreService,
				useValue: { state: signal({ settings: { voiceRate: 0.95 } }) },
			},
		],
	});
	return speech;
}

describe('reusable slide library behavior', () => {
	it('submits general single and multiple selections without correctness', () => {
		const next = vi.fn();
		const component = new SelectionSlideComponent();
		const states: unknown[] = [];
		const events: unknown[] = [];
		component.stateChange.subscribe((state) => states.push(state));
		component.event.subscribe((event) => events.push(event));
		component.load({
			slideId: 'selection',
			type: 'selection',
			data: {
				mode: 'single',
				question: 'Choose a practice mode',
				options: [
					{ id: 'dictation', label: 'Vocabulary Dictation', description: 'Hear and type a word or collocation.' },
					{ id: 'completion', label: 'Sentence Completion', description: 'Complete a sentence from audio.' },
				],
			},
			deck: { insertSlides: vi.fn(), next, results: () => [] },
		});

		expect(states.at(-1)).toEqual({ chrome: { footer: { primary: { disabled: true } } } });
		component.selectOption('completion');
		expect(component.selectedOptionIds()).toEqual(['completion']);
		expect(states.at(-1)).toEqual({ chrome: { footer: { primary: { disabled: false } } } });
		component.handleAction('continue');
		expect(events.at(-1)).toEqual({ type: 'submitted', data: { selectedOptionIds: ['completion'] } });
		expect(next).toHaveBeenCalledOnce();

		component.load({
			slideId: 'selection',
			type: 'selection',
			data: {
				mode: 'multiple',
				question: 'Choose study topics',
				options: [
					{ id: 'vocabulary', label: 'Vocabulary' },
					{ id: 'grammar', label: 'Grammar' },
					{ id: 'listening', label: 'Listening' },
				],
			},
			deck: { insertSlides: vi.fn(), next, results: () => [] },
		});
		component.selectOption('vocabulary');
		component.selectOption('listening');
		expect(component.selectedOptionIds()).toEqual(['vocabulary', 'listening']);
		component.selectOption('vocabulary');
		expect(component.selectedOptionIds()).toEqual(['listening']);

		expect(() => component.load({
			slideId: 'selection',
			type: 'selection',
			data: {
				mode: 'ranked',
				question: 'Choose an option',
				options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
			},
		})).toThrow('Selection mode must be single or multiple.');

		expect(() => component.load({
			slideId: 'selection',
			type: 'selection',
			data: {
				mode: 'single',
				question: 'Choose an option',
				expansionId: ' ',
				options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
			},
		})).toThrow('Selection expansionId is required when configured.');
	});

	it('expands a selection through its external runtime handler before advancing', async () => {
		const insertSlides = vi.fn();
		const next = vi.fn();
		const expansion = vi.fn().mockResolvedValue({
			slides: [{ id: 'generated-one', type: 'message', data: { title: 'One' } }],
		});
		const component = new SelectionSlideComponent();
		const events: unknown[] = [];
		component.event.subscribe((event) => events.push(event));
		component.load({
			slideId: 'selection',
			type: 'selection',
			data: {
				mode: 'single',
				question: 'Choose a path',
				expansionId: 'build-path',
				options: [
					{ id: 'first', label: 'First' },
					{ id: 'second', label: 'Second' },
				],
			},
			environment: { selectionExpansion: expansion },
			deck: { insertSlides, next, results: () => [] },
		});
		component.selectOption('second');
		component.handleAction('continue');

		await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
		expect(expansion).toHaveBeenCalledWith({
			expansionId: 'build-path',
			slideId: 'selection',
			selectedOptionIds: ['second'],
		});
		expect(insertSlides).toHaveBeenCalledWith({
			anchorId: 'selection',
			gap: 0,
			slides: [{ id: 'generated-one', type: 'message', data: { title: 'One' } }],
		});
		expect(events).toEqual([{ type: 'submitted', data: { selectedOptionIds: ['second'] } }]);
	});

	it('keeps an expanded selection open when generation fails', async () => {
		const next = vi.fn();
		const states: unknown[] = [];
		const component = new SelectionSlideComponent();
		component.stateChange.subscribe((state) => states.push(state));
		component.load({
			slideId: 'selection',
			type: 'selection',
			data: {
				mode: 'single',
				question: 'Choose a path',
				expansionId: 'build-path',
				options: [
					{ id: 'first', label: 'First' },
					{ id: 'second', label: 'Second' },
				],
			},
			environment: {
				selectionExpansion: vi.fn().mockRejectedValue(new Error('No items are available.')),
			},
			deck: { insertSlides: vi.fn(), next, results: () => [] },
		});
		component.selectOption('first');
		component.handleAction('continue');

		await vi.waitFor(() => expect(states.at(-1)).toMatchObject({
			chrome: { footer: { tone: 'error', detail: 'No items are available.' } },
		}));
		expect(next).not.toHaveBeenCalled();
	});

	it('shows the correct ShortAnswerSlide answer in the footer after a wrong answer', () => {
		const component = new ShortAnswerSlideComponent();
		let footerDetail = '';
		component.stateChange.subscribe((state) => {
			footerDetail = state.chrome?.footer?.detail ?? footerDetail;
		});
		load(component, 'short-answer', {
			question: 'Which noun describes a strong emotional connection?',
			answers: ['bond', 'connection'],
			exactSpelling: true,
		});

		component.setAnswer('friendship');
		component.handleAction('check');

		expect(component.interactionState()).toBe('answered-incorrect');
		expect(footerDetail).toBe('Correct answer: bond');
	});

	it('selects ChoiceSlide options by number and preserves wrong and correct states after checking', () => {
		configure();
		const component = TestBed.runInInjectionContext(
			() => new ChoiceSlideComponent(),
		);
		load(component, 'choice', {
			question: 'Choose the correct spelling.',
			options: [
				{ id: 'a', label: 'enviroment' },
				{ id: 'b', label: 'environment' },
			],
			correctOptionIds: ['b'],
		});

		component.handleShortcut('1');
		expect(component.selectedOptionIds()).toEqual(['a']);
		component.handleAction('check');

		expect(component.interactionState()).toBe('answered-incorrect');
		expect(component.optionState('a')).toBe('incorrect');
		expect(component.optionState('b')).toBe('correct');
	});

	it('supports multiple ChoiceSlide selection and a correct result', () => {
		configure();
		const component = TestBed.runInInjectionContext(
			() => new ChoiceSlideComponent(),
		);
		load(component, 'choice', {
			mode: 'multiple',
			question: 'Choose both formal words.',
			options: [
				{ id: 'a', label: 'purchase' },
				{ id: 'b', label: 'buy' },
				{ id: 'c', label: 'obtain' },
			],
			correctOptionIds: ['a', 'c'],
		});
		component.selectOption('a');
		component.selectOption('c');
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-correct');
	});

	it('supports optional generic speech autoplay and replay for ChoiceSlide', () => {
		const speech = configure();
		const component = TestBed.runInInjectionContext(
			() => new ChoiceSlideComponent(),
		);
		load(component, 'choice', {
			question: 'persistent',
			options: [
				{ id: 'a', label: 'continuing for a long time' },
				{ id: 'b', label: 'ending quickly' },
			],
			correctOptionIds: ['a'],
			speech: { text: 'persistent', autoplay: true, replay: true },
		});

		expect(speech.speak).toHaveBeenCalledWith('persistent', 0.95);
		component.playSpeech();
		expect(speech.speak).toHaveBeenCalledTimes(2);
		component.ngOnDestroy();
		expect(speech.cancel).toHaveBeenCalledOnce();
	});

	it('plays the left MatchingSlide phrase when it is selected', () => {
		const speech = configure();
		const component = TestBed.runInInjectionContext(
			() => new MatchingSlideComponent(),
		);
		load(component, 'matching', {
			pairs: [
				{
					id: 'relationship',
					left: 'establish a relationship',
					right: 'create a new connection',
				},
			],
		});

		component.selectLeft('relationship');

		expect(speech.speak).toHaveBeenCalledWith(
			'establish a relationship',
			0.95,
		);
		component.ngOnDestroy();
		expect(speech.cancel).toHaveBeenCalledOnce();
	});

	it('locks correct MatchingSlide pairs, rejects wrong pairs, and completes only after every pair', () => {
		configure();
		const component = TestBed.runInInjectionContext(
			() => new MatchingSlideComponent(),
		);
		const events: unknown[] = [];
		component.event.subscribe((event) => events.push(event));
		load(component, 'matching', {
			instruction: 'Match each pair.',
			pairs: [
				{ id: 'make', left: 'make', right: 'a decision' },
				{ id: 'take', left: 'take', right: 'a risk' },
			],
		});

		component.selectLeft('make');
		component.selectRight('take');
		expect(component.matchedPairIds()).toEqual([]);
		component.selectLeft('make');
		component.selectRight('make');
		expect(component.matchedPairIds()).toEqual(['make']);
		expect(component.matchedAssignments()).toEqual({ make: 'make' });
		expect(component.interactionState()).toBe('idle');
		component.selectLeft('take');
		component.selectRight('take');
		expect(component.interactionState()).toBe('answered-correct');
		expect(events.at(-1)).toMatchObject({
			type: 'answered',
			data: { correct: true, assignments: { make: 'make', take: 'take' } },
		});
	});

	it('suppresses pair-level error feedback when MatchingSlide feedback is deferred', () => {
		configure();
		const component = TestBed.runInInjectionContext(
			() => new MatchingSlideComponent(),
		);
		const events: unknown[] = [];
		component.event.subscribe((event) => events.push(event));
		load(component, 'matching', {
			feedbackMode: 'on-complete',
			pairs: [
				{ id: 'make', left: 'make', right: 'a decision' },
				{ id: 'take', left: 'take', right: 'a risk' },
			],
		});

		component.selectLeft('make');
		component.selectRight('take');
		expect(component.wrongPair()).toBeNull();
		expect(component.pairFeedback()).toBe('');
		expect(events).toEqual([]);
	});

	it('validates every ClassificationSlide category assignment', () => {
		const speech = configure();
		const component = TestBed.runInInjectionContext(
			() => new ClassificationSlideComponent(),
		);
		load(component, 'classification', {
			instruction: 'Classify the words.',
			categories: [
				{ id: 'animal', label: 'Animal' },
				{ id: 'plant', label: 'Plant' },
			],
			items: [
				{ id: 'paw', label: 'paw', correctCategoryId: 'animal' },
				{ id: 'root', label: 'root', correctCategoryId: 'plant' },
			],
		});
		component.selectItem('paw');
		expect(speech.speak).toHaveBeenCalledWith('paw', 0.95);
		component.assignSelected('animal');
		component.selectItem('root');
		component.assignSelected('plant');
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-correct');
		expect(component.assignmentState('paw')).toBe('correct');
	});

	it('validates ClozeSlide blanks independently, including variants and word limits', () => {
		const component = new ClozeSlideComponent();
		load(component, 'cloze', {
			instruction: 'Complete the sentence.',
			content: '{{energy}} can reduce {{pollution}}.',
			blanks: [
				{ id: 'energy', answers: ['renewable energy'], wordLimit: 2 },
				{
					id: 'pollution',
					answers: ['emissions', 'pollution'],
					wordLimit: 1,
				},
			],
		});
		component.setAnswer('energy', 'renewable energy');
		component.setAnswer('pollution', ' emissions ');
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-correct');
		expect(component.blankState('energy')).toBe('correct');

		load(component, 'cloze', {
			content: '{{energy}}',
			blanks: [
				{ id: 'energy', answers: ['renewable energy'], wordLimit: 1 },
			],
		});
		component.setAnswer('energy', 'renewable energy');
		component.handleAction('check');
		expect(component.blankState('energy')).toBe('incorrect');
	});

	it('reveals shuffled answer options for a free-text ClozeSlide on request', () => {
		const component = new ClozeSlideComponent();
		load(component, 'cloze', {
			content: '{{first}} power reduces {{second}} and {{third}}.',
			blanks: [
				{ id: 'first', answers: ['Renewable'] },
				{ id: 'second', answers: ['emissions'] },
				{ id: 'third', answers: ['pollution'] },
			],
		});

		expect(component.answerOptionsVisible()).toBe(false);
		component.toggleAnswerOptions();

		expect(component.answerOptionsVisible()).toBe(true);
		expect(component.answerOptions()).toEqual([
			'emissions',
			'pollution',
			'Renewable',
		]);
	});

	it('advances across ClozeSlide blanks when the word bank is the only input', () => {
		const component = new ClozeSlideComponent();
		load(component, 'cloze', {
			content: '{{first}} power reduces {{second}}.',
			inputMode: 'word-bank',
			wordBank: ['Renewable', 'emissions'],
			blanks: [
				{ id: 'first', answers: ['Renewable'] },
				{ id: 'second', answers: ['emissions'] },
			],
		});

		component.useWord('Renewable');
		component.useWord('emissions');
		expect(component.answers()).toEqual({
			first: 'Renewable',
			second: 'emissions',
		});
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-correct');
	});

	it('fills the active select-mode ClozeSlide blank from numbered choices', () => {
		const component = new ClozeSlideComponent();
		load(component, 'cloze', {
			content: '{{first}} power reduces {{second}}.',
			inputMode: 'select',
			wordBank: ['Renewable', 'emissions', 'pollution'],
			blanks: [
				{ id: 'first', answers: ['Renewable'] },
				{ id: 'second', answers: ['emissions'] },
			],
		});

		component.selectChoice('Renewable');
		expect(component.answers()).toEqual({ first: 'Renewable' });
		expect(component.choiceState('Renewable')).toBe('selected');

		component.focusBlank('second');
		expect(component.choiceState('Renewable')).toBe('neutral');
		component.selectChoice('emissions');
		expect(component.answers()).toEqual({
			first: 'Renewable',
			second: 'emissions',
		});

		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-correct');
		expect(component.choiceState('emissions')).toBe('correct');
	});

	it('honors exact spelling and rejects unrenderable AnswerField configurations', () => {
		const component = new ClozeSlideComponent();
		load(component, 'cloze', {
			content: '{{term}}',
			blanks: [
				{ id: 'term', answers: ['environment'], exactSpelling: true },
			],
		});
		component.setAnswer('term', 'Environment.');
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-incorrect');

		expect(() =>
			load(new ClozeSlideComponent(), 'cloze', {
				content: '{{first}} and {{first}}',
				blanks: [
					{ id: 'first', answers: ['one'] },
					{ id: 'second', answers: ['two'] },
				],
			}),
		).toThrow('placeholders');

		expect(() =>
			load(
				new StructuredCompletionSlideComponent(),
				'structured-completion',
				{
					layout: 'table',
					fields: [
						{ id: 'visible', answers: ['one'] },
						{ id: 'missing', answers: ['two'] },
					],
					rows: [{ id: 'row', cells: [{ fieldId: 'visible' }] }],
				},
			),
		).toThrow('render every answer field once');
	});

	it('checks only the requested WordFormationSlide forms', () => {
		const component = new WordFormationSlideComponent();
		load(component, 'word-formation', {
			baseWord: 'create',
			fields: [
				{ id: 'noun', partOfSpeech: 'noun', answers: ['creation'] },
				{
					id: 'adjective',
					partOfSpeech: 'adjective',
					answers: ['creative'],
				},
			],
		});
		component.setAnswer('noun', 'creation');
		component.setAnswer('adjective', 'creative');
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-correct');
	});

	it('keeps original, learner correction, answer, and explanation in ErrorCorrectionSlide', () => {
		const component = new ErrorCorrectionSlideComponent();
		load(component, 'error-correction', {
			original: 'This is an economic car to run.',
			answers: ['This is an economical car to run.'],
			explanation: 'Economical means inexpensive to operate.',
		});
		component.setCorrection('This is an economical car to run.');
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-correct');
		expect(component.content()?.original).toContain('economic car');
		expect(component.correction()).toContain('economical car');
	});

	it('shares replay-limited audio control with DictationSlide and enforces exact spelling', () => {
		configure();
		const audioControl = new SlideAudioControlComponent();
		audioControl.maxReplays = 1;
		const play = vi.fn().mockResolvedValue(undefined);
		audioControl.play({
			play,
			currentTime: 2,
		} as unknown as HTMLAudioElement);
		audioControl.play({
			play,
			currentTime: 2,
		} as unknown as HTMLAudioElement);
		expect(play).toHaveBeenCalledTimes(1);

		const component = TestBed.runInInjectionContext(
			() => new DictationSlideComponent(),
		);
		load(component, 'dictation', {
			audio: '/audio/example.mp3',
			answer: 'environment',
			maxReplays: 1,
		});
		component.setAnswer('Environment');
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-incorrect');
	});

	it('supports browser speech as the playback source for word dictation', () => {
		const speech = configure();
		const component = TestBed.runInInjectionContext(
			() => new DictationSlideComponent(),
		);
		load(component, 'dictation', {
			speech: { text: 'environment', autoplay: true, replay: true },
			answer: 'environment',
			acceptedAnswers: ['environment'],
			caseSensitive: false,
		});

		expect(speech.speak).toHaveBeenCalledWith('environment', 0.95);
		component.setAnswer('Environment');
		component.handleAction('check');
		expect(component.interactionState()).toBe('answered-correct');
	});

	it('submits model-only RewriteSlide responses without false scoring', () => {
		const component = new RewriteSlideComponent();
		const events: unknown[] = [];
		component.event.subscribe((event) => events.push(event));
		load(component, 'rewrite', {
			original: 'People use less energy now.',
			modelAnswer: 'Less energy is used now.',
		});

		component.setResponse('Energy use has fallen.');
		component.handleAction('submit');
		expect(component.interactionState()).toBe('revealed');
		expect(events.at(-1)).toMatchObject({
			type: 'submitted',
			data: { response: 'Energy use has fallen.' },
		});
	});

	it('moves SpeakingResponseSlide through recording and enables submission after stopping', async () => {
		configure();
		const component = TestBed.runInInjectionContext(
			() => new SpeakingResponseSlideComponent(),
		);
		load(component, 'speaking-response', {
			mode: 'part1',
			prompt: 'What technology do you use?',
		});
		await component.startRecording();
		expect(component.recordingState()).toBe('recording');
		await component.stopRecording();
		expect(component.recordingState()).toBe('recorded');
		expect(component.recordingUrl()).toBe('blob:recording');
	});

	it('counts and persists WritingResponseSlide responses in the emitted result', () => {
		const component = new WritingResponseSlideComponent();
		const events: unknown[] = [];
		component.event.subscribe((event) => events.push(event));
		load(component, 'writing-response', {
			mode: 'sentence',
			prompt: 'Write one sentence.',
		});
		component.setResponse('Energy use declined significantly.');
		expect(component.wordCount()).toBe(4);
		component.handleAction('submit');
		expect(events.at(-1)).toMatchObject({
			type: 'submitted',
			data: {
				response: 'Energy use declined significantly.',
				wordCount: 4,
			},
		});
	});
});
