import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	signal,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import { ScoredSlideBase } from '../../scored-slide.base';
import type { RewriteSlideData } from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import {
	common,
	inputValue,
	stringMode,
} from '../../slide-library.component-support';
import {
	normalizeAnswer,
	record,
	requiredText,
	strings,
	text,
} from '../../slide-library.utils';

function parseRewrite(value: unknown): RewriteSlideData {
	const source = record(value);
	const acceptedAnswers = strings(source['acceptedAnswers']);
	const requiredFragments = strings(source['requiredFragments']);
	const modelAnswer = text(source['modelAnswer']) || undefined;
	if (!acceptedAnswers.length && !requiredFragments.length && !modelAnswer)
		throw new Error('Rewrite slide requires an accepted or model answer.');
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'paraphrase',
				'target-grammar',
				'target-vocabulary',
				'sentence-transformation',
				'noun-to-verb',
				'verb-to-noun',
				'formalize',
				'linking-word',
				'synonym-replacement',
			] as const,
			'paraphrase',
		),
		original: requiredText(source['original'], 'Original text'),
		acceptedAnswers,
		requiredFragments,
		targetWords: strings(source['targetWords']),
		modelAnswer,
	};
}

@Component({
	selector: 'app-rewrite-slide',
	standalone: true,
	imports: [
		MatChipsModule,
		MatFormFieldModule,
		MatInputModule,
		SlideStimulusComponent,
	],
	templateUrl: './rewrite-slide.component.html',
	styleUrls: [
		'../../slide-library.component.scss',
		'../../slide-library-language.component.scss',
		'../../slide-library-supporting.component.scss',
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RewriteSlideComponent
	extends ScoredSlideBase<RewriteSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly response = signal('');
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		const data = parseRewrite(context.data);
		this.begin(
			context.slideId,
			data,
			this.isScored(data) ? 'check' : 'submit',
		);
		this.response.set('');
	}
	setResponse(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.response.set(value);
		this.setReady(
			Boolean(value.trim()),
			this.isScored(this.data()) ? 'check' : 'submit',
		);
	}
	private isScored(data: RewriteSlideData): boolean {
		return Boolean(
			data.acceptedAnswers?.length || data.requiredFragments?.length,
		);
	}
	private correct(): boolean {
		const data = this.data();
		const normalized = normalizeAnswer(this.response());
		return Boolean(
			data.acceptedAnswers?.some(
				(answer) => normalizeAnswer(answer) === normalized,
			) ||
			(data.requiredFragments?.length &&
				data.requiredFragments.every((fragment) =>
					normalized.includes(normalizeAnswer(fragment)),
				)),
		);
	}
	responseState(): string {
		if (!this.isScored(this.data())) return 'neutral';
		return this.interactionState() === 'idle'
			? 'neutral'
			: this.correct()
				? 'correct'
				: 'incorrect';
	}
	handleAction(actionId: string): void {
		if (!this.response().trim()) return;
		if (!this.isScored(this.data())) {
			if (actionId !== 'submit') return;
			this.submit({
				response: this.response(),
				modelAnswer: this.data().modelAnswer,
			});
			return;
		}
		if (actionId !== 'check') return;
		const correct = this.correct();
		this.finish(
			correct,
			{
				response: this.response(),
				correct,
				modelAnswer: this.data().modelAnswer,
			},
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}
