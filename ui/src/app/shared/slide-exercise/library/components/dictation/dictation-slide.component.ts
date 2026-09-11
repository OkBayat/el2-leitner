import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	OnDestroy,
	ViewChild,
	inject,
	signal,
} from '@angular/core';
import { VocoButtonComponent } from '../../../../voco-button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
	SpeechService,
	type SpeechPlaybackMode,
} from '../../../../../core/speech/speech.service';
import { LearningStoreService } from '../../../../../core/state/learning-store.service';
import { ReviewAnswerSoundService } from '../../../../../core/sound/review-answer-sound.service';
import { ShortcutClickDirective } from '../../../../shortcut-click.directive';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import { ScoredSlideBase } from '../../scored-slide.base';
import { SlideAudioControlComponent } from '../../slide-audio-control.component';
import type { DictationSlideData } from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import {
	common,
	inputValue,
	stringMode,
} from '../../slide-library.component-support';
import {
	answerMatches,
	record,
	requiredText,
	strings,
	text,
} from '../../slide-library.utils';
import {
	DictationRemediationAttempt,
	DictationRemediationPhase,
	type DictationRemediationSnapshot,
} from './dictation-remediation';

type DictationRemediationBadge = {
	icon: 'mistake' | 'memory' | 'copy';
	label: 'SPELLING CORRECTION' | 'RECALL FROM MEMORY' | 'COPY THE CORRECTION';
};

function parseDictation(value: unknown): DictationSlideData {
	const source = record(value);
	const answer = requiredText(source['answer'], 'Dictation answer');
	const maxReplays = Number(source['maxReplays']);
	const audio = text(source['audio']);
	const speechSource =
		source['speech'] === undefined
			? null
			: record(source['speech'], 'dictation speech playback');
	if (Boolean(audio) === Boolean(speechSource)) {
		throw new Error(
			'Dictation requires exactly one audio or speech playback source.',
		);
	}
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			['word', 'phrase', 'sentence'] as const,
			'word',
		),
		audio: audio || undefined,
		speech: speechSource
			? {
					text: requiredText(
						speechSource['text'],
						'Dictation speech playback text',
					),
					autoplay: speechSource['autoplay'] === true,
					replay: speechSource['replay'] !== false,
				}
			: undefined,
		answer,
		definition: text(source['definition']) || undefined,
		acceptedAnswers: strings(source['acceptedAnswers']),
		maxReplays:
			Number.isInteger(maxReplays) && maxReplays > 0
				? maxReplays
				: undefined,
		punctuationSensitive: source['punctuationSensitive'] === true,
		caseSensitive: source['caseSensitive'] !== false,
	};
}

@Component({
	selector: 'app-dictation-slide',
	standalone: true,
	imports: [
		VocoButtonComponent,
		MatFormFieldModule,
		MatInputModule,
		ShortcutClickDirective,
		SlideAudioControlComponent,
		SlideStimulusComponent,
	],
	templateUrl: './dictation-slide.component.html',
	styleUrls: [
		'../../slide-library.component.scss',
		'./dictation-slide.component.scss',
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DictationSlideComponent
	extends ScoredSlideBase<DictationSlideData>
	implements SlideContentComponent, AfterViewInit, OnDestroy
{
	private readonly speech = inject(SpeechService);
	private readonly store = inject(LearningStoreService);
	private readonly answerSound = inject(ReviewAnswerSoundService);
	private remediationAttempt: DictationRemediationAttempt | null = null;
	@ViewChild('answerInput')
	private answerInput?: ElementRef<HTMLTextAreaElement>;
	readonly answer = signal('');
	readonly replayCount = signal(0);
	readonly remediation = signal<DictationRemediationSnapshot | null>(null);
	readonly showAnswerInput = computed(
		() => this.remediation()?.phase !== DictationRemediationPhase.CORRECTION,
	);
	readonly showComparison = computed(() => {
		const remediation = this.remediation();
		return Boolean(
			remediation?.answerVisible &&
				remediation.phase !== DictationRemediationPhase.COMPLETED,
		);
	});
	readonly answerLabel = computed(() => {
		const phase = this.remediation()?.phase;
		if (phase === DictationRemediationPhase.COPY) return 'Exact copy';
		if (
			phase === DictationRemediationPhase.RECALL ||
			phase === DictationRemediationPhase.COMPLETED
		) {
			return 'Recall from memory';
		}
		return 'Your answer';
	});
	readonly remediationBadge = computed<DictationRemediationBadge | null>(() => {
		const phase = this.remediation()?.phase;
		if (phase === DictationRemediationPhase.CORRECTION) {
			return { icon: 'mistake', label: 'SPELLING CORRECTION' };
		}
		if (phase === DictationRemediationPhase.COPY) {
			return { icon: 'copy', label: 'COPY THE CORRECTION' };
		}
		if (
			phase === DictationRemediationPhase.RECALL ||
			phase === DictationRemediationPhase.COMPLETED
		) {
			return { icon: 'memory', label: 'RECALL FROM MEMORY' };
		}
		return null;
	});
	readonly answerReadOnly = computed(
		() => this.remediation()?.phase === DictationRemediationPhase.COMPLETED,
	);
	readonly answerDisabled = computed(
		() => this.interactionState() !== 'idle' && !this.answerReadOnly(),
	);
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		this.answerSound.stop();
		this.begin(context.slideId, parseDictation(context.data));
		this.remediationAttempt = null;
		this.remediation.set(null);
		this.answer.set('');
		this.replayCount.set(0);
		if (this.data().speech?.autoplay) this.playSpeech();
	}
	canReplay(): boolean {
		return (
			!this.data().maxReplays ||
			this.replayCount() < this.data().maxReplays!
		);
	}
	playSpeech(mode: SpeechPlaybackMode = 'normal'): boolean {
		const playback = this.data().speech;
		if (!playback || !this.canReplay()) return false;
		const rate = this.store.state()?.settings.voiceRate ?? 0.85;
		const played =
			mode === 'normal'
				? this.speech.speak(playback.text, rate)
				: this.speech.speak(
						playback.text,
						rate,
						undefined,
						undefined,
						mode,
					);
		if (played) this.replayCount.update((count) => count + 1);
		return played;
	}
	setAnswer(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.answer.set(value);
		this.setReady(Boolean(value.trim()));
	}
	private correct(answer = this.answer()): boolean {
		const data = this.data();
		return answerMatches(answer, {
			answers: [data.answer, ...(data.acceptedAnswers ?? [])],
			caseSensitive: data.caseSensitive,
			punctuationSensitive: data.punctuationSensitive,
		});
	}
	answerState(): string {
		return this.interactionState() === 'idle'
			? 'neutral'
			: this.correct()
				? 'correct'
				: 'incorrect';
	}
	ngAfterViewInit(): void {
		this.answerInput?.nativeElement.focus();
	}
	handleAction(actionId: string): void {
		if (actionId === 'continue') {
			this.acknowledgeCorrection();
			return;
		}
		if (actionId !== 'check' || !this.answer().trim()) return;
		if (this.remediationAttempt) {
			this.submitRemediationAnswer();
			return;
		}
		const correct = this.correct();
		if (!correct) {
			const data = this.data();
			this.remediationAttempt = DictationRemediationAttempt.start({
				accepted: [data.answer, ...(data.acceptedAnswers ?? [])],
				initialAnswer: this.answer(),
				matches: (answer) => this.correct(answer),
			});
			this.remediation.set(this.remediationAttempt.snapshot());
		}
		this.finish(
			correct,
			{ answer: this.answer(), correct, replayCount: this.replayCount() },
			this.data().definition ?? this.data().explanation ?? '',
			correct ? 'next' : 'content',
		);
	}
	tokenValue(value: string): string {
		return value === ' ' ? '\u00a0' : value;
	}
	private acknowledgeCorrection(): void {
		const attempt = this.remediationAttempt;
		if (!attempt || attempt.phase !== DictationRemediationPhase.CORRECTION) {
			return;
		}
		this.answerSound.stop();
		attempt.acknowledgeCorrection();
		this.remediation.set(attempt.snapshot());
		this.prepareRemediationInput(
			'From memory',
			'Type the spelling from memory, then check.',
		);
	}
	private submitRemediationAnswer(): void {
		const attempt = this.remediationAttempt;
		if (!attempt) return;
		const previousPhase = attempt.phase;
		let correct: boolean;
		if (previousPhase === DictationRemediationPhase.RECALL) {
			correct = attempt.submitRecall(this.answer());
		} else if (previousPhase === DictationRemediationPhase.COPY) {
			correct = attempt.submitCopy(this.answer());
		} else {
			return;
		}
		this.remediation.set(attempt.snapshot());
		this.answerSound.play(correct ? 'correct' : 'incorrect');
		if (attempt.phase === DictationRemediationPhase.COMPLETED) {
			this.interactionState.set('answered-correct');
			this.stateChanges.next({
				chrome: {
					footer: {
						tone: 'success',
						title: 'Nice!',
						detail:
							this.data().definition ??
							this.data().explanation ??
							'You remembered the spelling.',
						primary: {
							id: 'continue',
							label: 'Continue',
							behavior: 'next',
							disabled: false,
						},
					},
				},
			});
			return;
		}
		if (attempt.phase === DictationRemediationPhase.COPY) {
			this.prepareRemediationInput(
				'Practice the correction',
				'Copy the correct spelling exactly once, then check.',
			);
			return;
		}
		this.prepareRemediationInput(
			'From memory',
			'Type the spelling from memory, then check.',
		);
	}
	private prepareRemediationInput(title: string, detail: string): void {
		this.answer.set('');
		this.interactionState.set('idle');
		this.stateChanges.next({
			chrome: {
				footer: {
					tone: 'neutral',
					title,
					detail,
					primary: {
						id: 'check',
						label: 'Check',
						behavior: 'content',
						disabled: true,
					},
				},
			},
		});
		setTimeout(() => this.answerInput?.nativeElement.focus());
	}
	ngOnDestroy(): void {
		this.speech.cancel();
		this.answerSound.stop();
		this.destroy();
	}
}
