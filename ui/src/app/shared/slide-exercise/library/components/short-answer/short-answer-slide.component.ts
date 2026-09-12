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
import type { ShortAnswerSlideData } from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import { common, inputValue } from '../../slide-library.component-support';
import {
	answerMatches,
	record,
	requiredText,
	strings,
	text,
} from '../../slide-library.utils';

function parseShortAnswer(value: unknown): ShortAnswerSlideData {
	const source = record(value);
	const answers = strings(source['answers']);
	if (!answers.length) throw new Error('Short-answer answers are required.');
	const characterCount = Number(source['characterCount']);
	const evidencePrompt = text(source['evidencePrompt']);
	if ('evidenceRequired' in source && typeof source['evidenceRequired'] !== 'boolean')
		throw new Error('Short-answer evidenceRequired must be a boolean.');
	if (source['evidenceRequired'] === true && !evidencePrompt)
		throw new Error('Short-answer evidencePrompt is required when evidence is required.');
	return {
		...common(source),
		question: requiredText(source['question'], 'Short-answer question'),
		answers,
		firstLetterHint: text(source['firstLetterHint']) || undefined,
		characterCount:
			Number.isInteger(characterCount) && characterCount > 0
				? characterCount
				: undefined,
		exactSpelling: source['exactSpelling'] === true,
		evidencePrompt: evidencePrompt || undefined,
		evidenceRequired: source['evidenceRequired'] === true,
	};
}

@Component({
	selector: 'app-short-answer-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule, SlideStimulusComponent],
	templateUrl: './short-answer-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortAnswerSlideComponent
	extends ScoredSlideBase<ShortAnswerSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly answer = signal('');
	readonly supportingEvidence = signal('');
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseShortAnswer(context.data));
		this.answer.set('');
		this.supportingEvidence.set('');
	}
	private updateReady(): void {
		const data = this.data();
		this.setReady(
			Boolean(this.answer().trim()) &&
				(!data.evidenceRequired || Boolean(this.supportingEvidence().trim())),
		);
	}
	setAnswer(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.answer.set(value);
		this.updateReady();
	}
	setSupportingEvidence(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.supportingEvidence.set(value);
		this.updateReady();
	}
	private correct(): boolean {
		const data = this.data();
		return answerMatches(this.answer(), {
			answers: data.answers,
			caseSensitive: data.exactSpelling,
			punctuationSensitive: data.exactSpelling,
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
		if (
			actionId !== 'check' ||
			!this.answer().trim() ||
			(this.data().evidenceRequired && !this.supportingEvidence().trim())
		)
			return;
		const data = this.data();
		const correct = this.correct();
		const detail = correct
			? (data.explanation ?? '')
			: [`Correct answer: ${data.answers[0]}`, data.explanation]
					.filter(Boolean)
					.join(' ');
		this.finish(
			correct,
			{
				answer: this.answer(),
				supportingEvidence: this.supportingEvidence(),
				correct,
			},
			detail,
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}
