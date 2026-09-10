import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	effect,
	inject,
	signal,
	untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
	SpeechService,
	type SpeechPlaybackObserver,
} from '../../../../../core/speech/speech.service';
import { LearningStoreService } from '../../../../../core/state/learning-store.service';
import { ShortcutClickDirective } from '../../../../shortcut-click.directive';
import type {
	PronunciationPracticeController,
	SlideContentContext,
} from '../../../slide-content-contracts';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import { common, stringMode } from '../../slide-library.component-support';
import { options, record, requiredText } from '../../slide-library.utils';
import { ChoiceSlideComponent } from '../choice/choice-slide.component';

interface PlaybackToken {
	readonly text: string;
	readonly start: number;
	readonly word: boolean;
	readonly wordIndex: number | null;
}

function playbackTokens(text: string): readonly PlaybackToken[] {
	let wordIndex = 0;
	return [...text.matchAll(/\s+|[^\s]+/gu)].map((match) => {
		const word = /\S/u.test(match[0]);
		const assessmentWord = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/u.test(
			match[0],
		);
		return {
			text: match[0],
			start: match.index ?? 0,
			word,
			wordIndex: assessmentWord ? wordIndex++ : null,
		};
	});
}

function practiceController(environment: unknown): PronunciationPracticeController {
	const candidate = record(environment, 'pronunciation environment')['pronunciationPractice'];
	if (!candidate || typeof candidate !== 'object') {
		throw new Error('Pronunciation recording is unavailable.');
	}
	const controller = candidate as PronunciationPracticeController;
	if (
		typeof controller.phase !== 'function' ||
		typeof controller.levels !== 'function' ||
		typeof controller.seconds !== 'function' ||
		typeof controller.assessment !== 'function' ||
		typeof controller.result !== 'function' ||
		typeof controller.error !== 'function' ||
		typeof controller.selectPrompt !== 'function' ||
		typeof controller.record !== 'function' ||
		typeof controller.stop !== 'function' ||
		typeof controller.pause !== 'function'
	) {
		throw new Error('Pronunciation recording is unavailable.');
	}
	return controller;
}

@Component({
	selector: 'app-pronunciation-slide',
	standalone: true,
	imports: [MatButtonModule, ShortcutClickDirective, SlideStimulusComponent],
	templateUrl: './pronunciation-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PronunciationSlideComponent
	extends ChoiceSlideComponent
	implements OnDestroy
{
	private readonly sentenceSpeech = inject(SpeechService);
	private readonly sentenceStore = inject(LearningStoreService);
	private readonly controller = signal<PronunciationPracticeController | null>(null);
	private lastResult: unknown = null;
	private failedAttempts = 0;
	readonly repeatMode = signal(false);
	readonly tokens = signal<readonly PlaybackToken[]>([]);
	readonly playbackActive = signal(false);
	readonly playbackCharIndex = signal<number | null>(null);
	private readonly recognizedWordIndexes = signal<ReadonlySet<number>>(new Set());

	constructor() {
		super();
		effect(() => {
			const result = this.controller()?.result();
			if (!result || result === this.lastResult || this.interactionState() !== 'idle') return;
			this.lastResult = result;
			const recognized = new Set(untracked(this.recognizedWordIndexes));
			result.words.forEach((word, index) => {
				if (word.matched) recognized.add(index);
			});
			this.recognizedWordIndexes.set(recognized);
			const matchedCount = [...recognized].filter(
				(index) => index < result.totalCount,
			).length;
			const score = result.totalCount
				? Math.floor((matchedCount * 1000) / result.totalCount) / 10
				: 0;
			const data = {
				correct: result.passed,
				score,
				transcript: result.transcript,
				matchedCount,
				totalCount: result.totalCount,
			};
			const detail = `${matchedCount} of ${result.totalCount} words recognized · ${score}%`;
			if (result.passed) {
				this.finish(true, data, detail);
				return;
			}
			this.failedAttempts += 1;
			if (this.failedAttempts <= 3) {
				this.showRetry(detail);
				return;
			}
			this.finish(false, data, detail);
		});
		effect(() => {
			const assessment = this.controller()?.assessment();
			if (!assessment) return;
			const matched = assessment.words
				.map((word, index) => word.matched ? index : -1)
				.filter((index) => index >= 0);
			const current = untracked(this.recognizedWordIndexes);
			const additions = matched.filter((index) => !current.has(index));
			if (additions.length) {
				this.recognizedWordIndexes.set(new Set([...current, ...additions]));
			}
		});
	}

	override load(context: SlideContentContext): void {
		this.sentenceSpeech.cancel();
		this.controller()?.pause();
		this.resetPlayback();
		this.lastResult = null;
		this.failedAttempts = 0;
		this.recognizedWordIndexes.set(new Set());
		const source = record(context.data);
		const mode = stringMode(
			source['mode'],
			[
				'phoneme-match',
				'sound-choice',
				'word-stress',
				'listen-and-identify',
				'ipa-match',
				'repeat',
			] as const,
			'sound-choice',
		);
		if (mode !== 'repeat') {
			this.repeatMode.set(false);
			this.controller.set(null);
			super.load({
				...context,
				data: {
					...common(source),
					mode: 'single',
					question: requiredText(source['question'], 'Pronunciation question'),
					options: options(source['options']),
					correctOptionIds: [requiredText(source['correctOptionId'], 'Pronunciation answer')],
				},
			});
			return;
		}

		const speech = record(source['speech'], 'pronunciation speech playback');
		const recording = record(source['recording'], 'pronunciation recording');
		const sentence = requiredText(speech['text'], 'Pronunciation speech playback text');
		const question = requiredText(source['question'], 'Pronunciation question');
		if (sentence !== question) {
			throw new Error('Pronunciation speech playback text must match the sentence.');
		}
		const controller = practiceController(context.environment);
		const itemId = requiredText(recording['itemId'], 'Pronunciation recording item');
		const promptId = requiredText(recording['promptId'], 'Pronunciation recording prompt');
		if (!controller.selectPrompt(itemId, promptId)) {
			throw new Error('Pronunciation sentence is unavailable in this practice session.');
		}
		this.repeatMode.set(true);
		this.controller.set(controller);
		this.tokens.set(playbackTokens(sentence));
		this.begin(context.slideId, {
			...common(source),
			mode: 'single',
			question,
			options: [],
			correctOptionIds: [],
			speech: { text: sentence, replay: true },
		});
		this.selectedOptionIds.set([]);
		this.hideFooterAction();
		this.playSentence();
	}

	playSentence(): boolean {
		if (!this.repeatMode() || this.practiceBusy()) return false;
		const playback = this.data().speech;
		if (!playback) return false;
		this.resetPlayback();
		const observer: SpeechPlaybackObserver = {
			onStart: () => {
				if (this.data().speech !== playback) return;
				this.playbackActive.set(true);
			},
			onWordBoundary: (charIndex) => {
				if (this.data().speech !== playback) return;
				this.playbackActive.set(true);
				this.playbackCharIndex.set(charIndex);
			},
			onEnd: () => {
				if (this.data().speech !== playback) return;
				this.playbackActive.set(false);
				this.playbackCharIndex.set(playback.text.length);
				void this.startRecording();
			},
			onError: () => this.resetPlayback(),
		};
		const rate = this.sentenceStore.state()?.settings.voiceRate ?? 0.85;
		const started = this.sentenceSpeech.speak(playback.text, rate, observer);
		if (!started) this.resetPlayback();
		return started;
	}

	isTokenSpoken(token: PlaybackToken): boolean {
		const charIndex = this.playbackCharIndex();
		return token.word && charIndex !== null && charIndex >= token.start;
	}

	isTokenRecognized(token: PlaybackToken): boolean {
		return Boolean(
			token.wordIndex !== null &&
				this.recognizedWordIndexes().has(token.wordIndex),
		);
	}

	practice(): PronunciationPracticeController | null {
		return this.controller();
	}

	practiceBusy(): boolean {
		return ['requesting', 'recording', 'processing'].includes(this.controller()?.phase() ?? '');
	}

	async toggleRecording(): Promise<void> {
		const controller = this.controller();
		if (!controller) return;
		if (controller.phase() === 'recording') await controller.stop();
		else await this.startRecording();
	}

	override handleAction(actionId: string): void {
		if (this.repeatMode() && actionId === 'retry-pronunciation') {
			void this.startRecording();
			return;
		}
		super.handleAction(actionId);
	}

	override ngOnDestroy(): void {
		this.controller()?.pause();
		this.sentenceSpeech.cancel();
		this.resetPlayback();
		super.ngOnDestroy();
	}

	private async startRecording(): Promise<void> {
		const controller = this.controller();
		if (
			!controller?.supported ||
			!['ready', 'feedback', 'evaluation-error'].includes(controller.phase()) ||
			this.interactionState() !== 'idle'
		) return;
		this.recognizedWordIndexes.set(new Set());
		this.hideFooterAction();
		await controller.record();
	}

	private showRetry(detail: string): void {
		this.stateChanges.next({
			chrome: {
				footer: {
					tone: 'warning',
					title: 'Try again',
					detail,
					primary: {
						id: 'retry-pronunciation',
						label: 'Try again',
						behavior: 'content',
						disabled: false,
					},
				},
			},
		});
	}

	private hideFooterAction(): void {
		this.stateChanges.next({
			chrome: {
				footer: {
					tone: 'neutral',
					title: '',
					detail: '',
					primary: false,
				},
			},
		});
	}

	private resetPlayback(): void {
		this.playbackActive.set(false);
		this.playbackCharIndex.set(null);
	}
}
