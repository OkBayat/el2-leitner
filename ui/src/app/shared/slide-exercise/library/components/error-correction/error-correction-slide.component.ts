import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import { ScoredSlideBase } from '../../scored-slide.base';
import type { ErrorCorrectionSlideData } from '../../slide-library.models';
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

function parseErrorCorrection(value: unknown): ErrorCorrectionSlideData {
	const source = record(value);
	const answers = strings(source['answers']);
	if (!answers.length) throw new Error('Correction answers are required.');
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'select-and-replace',
				'inline-edit',
				'sentence-correction',
				'paragraph-correction',
			] as const,
			'sentence-correction',
		),
		category: text(source['category']) || undefined,
		original: requiredText(source['original'], 'Original text'),
		answers,
	};
}

@Component({
	selector: 'app-error-correction-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule, SlideStimulusComponent],
	templateUrl: './error-correction-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorCorrectionSlideComponent
	extends ScoredSlideBase<ErrorCorrectionSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly correction = signal('');
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseErrorCorrection(context.data));
		this.correction.set('');
	}
	setCorrection(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.correction.set(value);
		this.setReady(Boolean(value.trim()));
	}
	private correct(): boolean {
		return answerMatches(this.correction(), {
			answers: this.data().answers,
		});
	}
	correctionState(): string {
		return this.interactionState() === 'idle'
			? 'neutral'
			: this.correct()
				? 'correct'
				: 'incorrect';
	}
	handleAction(actionId: string): void {
		if (actionId !== 'check' || !this.correction().trim()) return;
		const correct = this.correct();
		this.finish(
			correct,
			{
				original: this.data().original,
				correction: this.correction(),
				correctAnswer: this.data().answers[0],
				correct,
			},
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}
