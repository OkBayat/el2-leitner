import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { SpeechService } from '../../../../../core/speech/speech.service';
import { LearningStoreService } from '../../../../../core/state/learning-store.service';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import { ScoredSlideBase } from '../../scored-slide.base';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import type { ChoiceSlideData, SlideOption } from '../../slide-library.models';
import { common, stringMode } from '../../slide-library.component-support';
import {
	equalIds,
	options,
	record,
	requiredText,
	strings,
} from '../../slide-library.utils';

const CHOICE_MODES = [
	'single',
	'multiple',
	'meaning',
	'part-of-speech',
	'synonym',
	'antonym',
	'correct-spelling',
	'best-word',
	'odd-one-out',
] as const;

function parseChoice(value: unknown): ChoiceSlideData {
	const source = record(value);
	const parsedOptions = options(source['options']);
	const correctOptionIds = strings(source['correctOptionIds']);
	if (
		parsedOptions.length < 2 ||
		!correctOptionIds.length ||
		correctOptionIds.some(
			(id) => !parsedOptions.some((option) => option.id === id),
		)
	) {
		throw new Error('Choice slide requires valid options and answers.');
	}
	const mode = stringMode(source['mode'], CHOICE_MODES, 'single');
	if (mode !== 'multiple' && correctOptionIds.length !== 1)
		throw new Error('Single-choice slides require one correct option.');
	const speechSource =
		source['speech'] === undefined
			? null
			: record(source['speech'], 'speech playback');
	return {
		...common(source),
		mode,
		question: requiredText(source['question'], 'Choice question'),
		options: parsedOptions,
		correctOptionIds,
		speech: speechSource
			? {
					text: requiredText(
						speechSource['text'],
						'Speech playback text',
					),
					autoplay: speechSource['autoplay'] === true,
					replay: speechSource['replay'] !== false,
				}
			: undefined,
	};
}

@Component({
	selector: 'app-choice-slide',
	standalone: true,
	imports: [MatButtonModule, SlideStimulusComponent],
	templateUrl: './choice-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChoiceSlideComponent
	extends ScoredSlideBase<ChoiceSlideData>
	implements SlideContentComponent, OnDestroy
{
	private readonly speech = inject(SpeechService);
	private readonly store = inject(LearningStoreService);
	readonly selectedOptionIds = signal<readonly string[]>([]);

	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseChoice(context.data));
		this.selectedOptionIds.set([]);
		if (this.data().speech?.autoplay) this.playSpeech();
	}

	playSpeech(): boolean {
		const speech = this.data().speech;
		if (!speech) return false;
		const rate = this.store.state()?.settings.voiceRate ?? 0.85;
		return this.speech.speak(speech.text, rate);
	}

	handleShortcut(key: string): void {
		const option = this.data().options[Number(key) - 1];
		if (option) this.selectOption(option.id);
	}

	selectOption(optionId: string): void {
		const data = this.data();
		if (
			this.interactionState() !== 'idle' ||
			!data.options.some((option) => option.id === optionId)
		)
			return;
		if (data.mode === 'multiple') {
			this.selectedOptionIds.update((ids) =>
				ids.includes(optionId)
					? ids.filter((id) => id !== optionId)
					: [...ids, optionId],
			);
		} else {
			this.selectedOptionIds.set([optionId]);
		}
		this.setReady(this.selectedOptionIds().length > 0);
	}

	isSelected(optionId: string): boolean {
		return this.selectedOptionIds().includes(optionId);
	}

	optionState(
		optionId: string,
	): 'neutral' | 'selected' | 'correct' | 'incorrect' {
		if (this.interactionState() === 'idle')
			return this.isSelected(optionId) ? 'selected' : 'neutral';
		if (this.data().correctOptionIds.includes(optionId)) return 'correct';
		return this.isSelected(optionId) ? 'incorrect' : 'neutral';
	}

	optionAriaLabel(option: SlideOption, index: number): string {
		const prefix = `${index + 1}. ${option.label}`;
		if (this.interactionState() === 'idle') return prefix;
		if (this.data().correctOptionIds.includes(option.id))
			return `${prefix}, correct answer`;
		if (this.isSelected(option.id))
			return `${prefix}, your answer, incorrect`;
		return prefix;
	}

	handleAction(actionId: string): void {
		if (
			actionId !== 'check' ||
			this.interactionState() !== 'idle' ||
			!this.selectedOptionIds().length
		)
			return;
		const selectedOptionIds = this.selectedOptionIds();
		const correctOptionIds = this.data().correctOptionIds;
		const correct = equalIds(selectedOptionIds, correctOptionIds);
		const correctLabels = this.data()
			.options.filter((option) => correctOptionIds.includes(option.id))
			.map((option) => option.label)
			.join(', ');
		const detail = correct
			? (this.data().explanation ?? '')
			: [`Correct answer: ${correctLabels}`, this.data().explanation]
					.filter(Boolean)
					.join(' ');
		this.finish(
			correct,
			{ selectedOptionIds, correctOptionIds, correct },
			detail,
		);
	}

	ngOnDestroy(): void {
		this.speech.cancel();
		this.destroy();
	}
}
