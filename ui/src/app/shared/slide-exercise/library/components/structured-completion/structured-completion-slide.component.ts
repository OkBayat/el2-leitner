import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import type {
	AnswerField,
	StructuredCompletionSlideData,
} from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import {
	AnswerFieldsSlideBase,
	common,
	stringMode,
} from '../../slide-library.component-support';
import {
	answerFields,
	equalIds,
	record,
	requiredText,
	strings,
	text,
} from '../../slide-library.utils';

function parseStructured(value: unknown): StructuredCompletionSlideData {
	const source = record(value);
	const fields = answerFields(source['fields']);
	const layout = stringMode(
		source['layout'],
		['form', 'table', 'notes', 'flowchart', 'timeline'] as const,
		'form',
	);
	const rows = Array.isArray(source['rows'])
		? source['rows'].map((candidate) => {
				const row = record(candidate, 'structured row');
				const cells = Array.isArray(row['cells'])
					? row['cells'].map((raw) => {
							const cell = record(raw, 'structured cell');
							return {
								text: text(cell['text']) || undefined,
								fieldId: text(cell['fieldId']) || undefined,
							};
						})
					: [];
				return {
					id: requiredText(row['id'], 'Structured row id'),
					cells,
				};
			})
		: undefined;
	if (layout === 'table' && rows?.length) {
		const renderedFieldIds = rows.flatMap((row) =>
			row.cells.flatMap((cell) => (cell.fieldId ? [cell.fieldId] : [])),
		);
		const requiredFieldIds = fields.map((field) => field.id);
		if (
			renderedFieldIds.length !== requiredFieldIds.length ||
			new Set(renderedFieldIds).size !== renderedFieldIds.length ||
			!equalIds(renderedFieldIds, requiredFieldIds)
		) {
			throw new Error(
				'Structured table rows must render every answer field once.',
			);
		}
	}
	return {
		...common(source),
		title: text(source['title']) || undefined,
		layout,
		fields,
		columns: strings(source['columns']),
		rows,
	};
}

@Component({
	selector: 'app-structured-completion-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule, SlideStimulusComponent],
	templateUrl: './structured-completion-slide.component.html',
	styleUrls: [
		'../../slide-library.component.scss',
		'../../slide-library-language.component.scss',
		'../../slide-library-supporting.component.scss',
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StructuredCompletionSlideComponent
	extends AnswerFieldsSlideBase<StructuredCompletionSlideData>
	implements SlideContentComponent, OnDestroy
{
	fields(): readonly AnswerField[] {
		return this.data().fields;
	}
	field(id: string): AnswerField | undefined {
		return this.fields().find((field) => field.id === id);
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseStructured(context.data));
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
