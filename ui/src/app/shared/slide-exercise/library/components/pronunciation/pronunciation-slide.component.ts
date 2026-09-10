import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	effect,
	inject,
	signal,
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
}

function playbackTokens(text: string): readonly PlaybackToken[] {
	return [...text.matchAll(/\s+|[^\s]+/gu)].map((match) => ({
		text: match[0],
		start: match.index ?? 0,
		word: /\S/u.test(match[0]),
	}));
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
	readonly repeatMode = signal(false);
	readonly tokens = signal<readonly PlaybackToken[]>([]);
	readonly playbackActive = signal(false);
	readonly playbackCharIndex = signal<number | null>(null);

	constructor() {
		super();
		effect(() => {
			const result = this.controller()?.result();
			if (!result || result === this.lastResult || this.interactionState() !== 'idle') return;
			this.lastResult = result;
			this.finish(
				result.passed,
				{
					correct: result.passed,
					score: result.score,
					transcript: result.transcript,
					matchedCount: result.matchedCount,
					totalCount: result.totalCount,
				},
				`${result.matchedCount} of ${result.totalCount} words recognized · ${result.score}%`,
			);
		});
	}

	override load(context: SlideContentContext): void {
		this.sentenceSpeech.cancel();
		this.controller()?.pause();
		this.resetPlayback();
		this.lastResult = null;
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

	override ngOnDestroy(): void {
		this.controller()?.pause();
		this.sentenceSpeech.cancel();
		this.resetPlayback();
		super.ngOnDestroy();
	}

	private async startRecording(): Promise<void> {
		const controller = this.controller();
		if (!controller?.supported || controller.phase() !== 'ready' || this.interactionState() !== 'idle') return;
		await controller.record();
	}

	private resetPlayback(): void {
		this.playbackActive.set(false);
		this.playbackCharIndex.set(null);
	}
}
