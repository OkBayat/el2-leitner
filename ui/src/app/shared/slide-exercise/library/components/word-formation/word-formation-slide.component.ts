import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import type {
	AnswerField,
	WordFormationSlideData,
} from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import {
	AnswerFieldsSlideBase,
	common,
	stringMode,
} from '../../slide-library.component-support';
import { answerFields, record, requiredText } from '../../slide-library.utils';

function parseWordFormation(value: unknown): WordFormationSlideData {
	const source = record(value);
	const baseFields = answerFields(source['fields']);
	const rawFields = source['fields'] as readonly unknown[];
	const fields = baseFields.map((field, index) => ({
		...field,
		partOfSpeech: requiredText(
			record(rawFields[index], 'word-formation field')['partOfSpeech'],
			'Part of speech',
		),
	}));
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'family',
				'target-part-of-speech',
				'prefix',
				'suffix',
				'negative-form',
				'base-word',
				'transitive-intransitive',
			] as const,
			'family',
		),
		baseWord: requiredText(source['baseWord'], 'Base word'),
		fields,
	};
}

@Component({
	selector: 'app-word-formation-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule, SlideStimulusComponent],
	templateUrl: './word-formation-slide.component.html',
	styleUrls: [
		'../../slide-library.component.scss',
		'../../slide-library-language.component.scss',
		'../../slide-library-supporting.component.scss',
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordFormationSlideComponent
	extends AnswerFieldsSlideBase<WordFormationSlideData>
	implements SlideContentComponent, OnDestroy
{
	fields(): readonly AnswerField[] {
		return this.data().fields;
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseWordFormation(context.data));
		this.answers.set({});
	}
	handleAction(actionId: string): void {
		if (
			actionId === 'check' &&
			this.fields().every((field) => this.answers()[field.id]?.trim())
		)
			this.checkFields();
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}
