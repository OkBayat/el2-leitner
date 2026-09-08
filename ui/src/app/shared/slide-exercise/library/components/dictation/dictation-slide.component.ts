import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
	signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SpeechService } from '../../../../../core/speech/speech.service';
import { LearningStoreService } from '../../../../../core/state/learning-store.service';
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
		MatFormFieldModule,
		MatInputModule,
		SlideAudioControlComponent,
		SlideStimulusComponent,
	],
	templateUrl: './dictation-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DictationSlideComponent
	extends ScoredSlideBase<DictationSlideData>
	implements SlideContentComponent, OnDestroy
{
	private readonly speech = inject(SpeechService);
	private readonly store = inject(LearningStoreService);
	readonly answer = signal('');
	readonly replayCount = signal(0);
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseDictation(context.data));
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
	playSpeech(): boolean {
		const playback = this.data().speech;
		if (!playback || !this.canReplay()) return false;
		const rate = this.store.state()?.settings.voiceRate ?? 0.85;
		const played = this.speech.speak(playback.text, rate);
		if (played) this.replayCount.update((count) => count + 1);
		return played;
	}
	setAnswer(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.answer.set(value);
		this.setReady(Boolean(value.trim()));
	}
	private correct(): boolean {
		const data = this.data();
		return answerMatches(this.answer(), {
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
	handleAction(actionId: string): void {
		if (actionId !== 'check' || !this.answer().trim()) return;
		const correct = this.correct();
		this.finish(
			correct,
			{ answer: this.answer(), correct, replayCount: this.replayCount() },
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.speech.cancel();
		this.destroy();
	}
}
