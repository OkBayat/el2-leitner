import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import {
	AnswerFieldsSlideBase,
	common,
	stringMode,
} from '../../slide-library.component-support';
import type {
	LabelingSlideData,
	LabelingTarget,
} from '../../slide-library.models';
import {
	answerMatches,
	answerFields,
	record,
	requiredText,
	strings,
} from '../../slide-library.utils';

function percent(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)
		throw new Error(
			'Labeling target coordinates must be between 0 and 100.',
		);
	return parsed;
}

function parseTargets(value: unknown): readonly LabelingTarget[] {
	if (!Array.isArray(value) || !value.length)
		throw new Error('Labeling targets are required.');
	const fields = answerFields(value);
	return value.map((candidate, index) => {
		const source = record(candidate, 'labeling target');
		const field = fields[index];
		return {
			...field,
			label: requiredText(source['label'], 'Labeling target label'),
			markerLabel: requiredText(
				source['markerLabel'],
				'Labeling target marker label',
			),
			xPercent: percent(source['xPercent']),
			yPercent: percent(source['yPercent']),
		};
	});
}

function parseLabeling(value: unknown): LabelingSlideData {
	const source = record(value);
	const shared = common(source);
	if (
		shared.stimulus?.type !== 'diagram' &&
		shared.stimulus?.type !== 'image'
	)
		throw new Error('Labeling requires an image or diagram stimulus.');
	const inputMode = stringMode(
		source['inputMode'],
		['text', 'word-bank'] as const,
		'text',
	);
	const wordBank = strings(source['wordBank']);
	if (inputMode === 'word-bank' && wordBank.length < 2)
		throw new Error('Word-bank labeling requires at least two options.');
	if (new Set(wordBank).size !== wordBank.length)
		throw new Error('Labeling word-bank options must be unique.');
	const targets = parseTargets(source['targets']);
	if (
		inputMode === 'word-bank' &&
		targets.some((target) =>
			wordBank.every((option) => !answerMatches(option, target)),
		)
	)
		throw new Error(
			'Every labeling target needs an accepted answer in the word bank.',
		);
	return {
		...shared,
		mode: stringMode(
			requiredText(source['mode'], 'Labeling mode'),
			['map', 'plan', 'diagram'] as const,
			'diagram',
		),
		question: requiredText(source['question'], 'Labeling question'),
		inputMode,
		wordBank: wordBank.length ? wordBank : undefined,
		targets,
	};
}

@Component({
	selector: 'app-labeling-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule, MatSelectModule],
	templateUrl: './labeling-slide.component.html',
	styleUrls: [
		'../../slide-library.component.scss',
		'../../slide-library-language.component.scss',
		'../../slide-library-supporting.component.scss',
		'./labeling-slide.component.scss',
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelingSlideComponent
	extends AnswerFieldsSlideBase<LabelingSlideData>
	implements SlideContentComponent, OnDestroy
{
	fields(): readonly LabelingTarget[] {
		return this.data().targets;
	}

	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseLabeling(context.data));
		this.answers.set({});
	}

	imageSource(data: LabelingSlideData): string {
		const stimulus = data.stimulus;
		return stimulus?.type === 'diagram'
			? stimulus.imageSrc
			: stimulus?.type === 'image'
				? stimulus.src
				: '';
	}

	imageAlt(data: LabelingSlideData): string {
		return data.stimulus?.type === 'diagram' ||
			data.stimulus?.type === 'image'
			? data.stimulus.alt
			: '';
	}

	imageCaption(data: LabelingSlideData): string {
		return data.stimulus?.type === 'diagram' ||
			data.stimulus?.type === 'image'
			? (data.stimulus.caption ?? '')
			: '';
	}

	handleAction(actionId: string): void {
		if (actionId === 'check') this.checkFields();
	}

	ngOnDestroy(): void {
		this.destroy();
	}
}
