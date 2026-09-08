import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import type { AnswerField, ClozeSlideData } from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import {
	AnswerFieldsSlideBase,
	common,
	stringMode,
} from '../../slide-library.component-support';
import {
	answerFields,
	record,
	requiredText,
	strings,
} from '../../slide-library.utils';

function clozeSegments(
	content: string,
): readonly { readonly text?: string; readonly fieldId?: string }[] {
	return content
		.split(/(\{\{[^{}]+\}\})/g)
		.filter(Boolean)
		.map((part) =>
			part.startsWith('{{') && part.endsWith('}}')
				? { fieldId: part.slice(2, -2).trim() }
				: { text: part },
		);
}

function parseCloze(value: unknown): ClozeSlideData {
	const source = record(value);
	const blanks = answerFields(source['blanks']);
	const content = requiredText(source['content'], 'Cloze content');
	const fieldIds = clozeSegments(content).flatMap((segment) =>
		segment.fieldId ? [segment.fieldId] : [],
	);
	if (
		fieldIds.length !== blanks.length ||
		new Set(fieldIds).size !== fieldIds.length ||
		fieldIds.some((id) => !blanks.some((blank) => blank.id === id))
	)
		throw new Error('Cloze placeholders must match answer fields.');
	return {
		...common(source),
		content,
		inputMode: stringMode(
			source['inputMode'],
			['text', 'word-bank', 'select'] as const,
			'text',
		),
		blanks,
		wordBank: strings(source['wordBank']),
	};
}

@Component({
	selector: 'app-cloze-slide',
	standalone: true,
	imports: [
		MatButtonModule,
		MatFormFieldModule,
		MatInputModule,
		MatSelectModule,
		SlideStimulusComponent,
	],
	templateUrl: './cloze-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClozeSlideComponent
	extends AnswerFieldsSlideBase<ClozeSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly segments = signal<ReturnType<typeof clozeSegments>>([]);
	readonly activeBlankId = signal('');
	fields(): readonly AnswerField[] {
		return this.data().blanks;
	}
	load(context: SlideContentContext): void {
		const data = parseCloze(context.data);
		this.begin(context.slideId, data);
		this.answers.set({});
		this.segments.set(clozeSegments(data.content));
		this.activeBlankId.set(data.blanks[0]?.id ?? '');
	}
	blank(id: string | undefined): AnswerField | undefined {
		return this.data().blanks.find((field) => field.id === id);
	}
	blankState(id: string): string {
		const field = this.blank(id);
		return field ? this.fieldState(field) : 'neutral';
	}
	override setAnswer(id: string, value: string): void {
		this.activeBlankId.set(id);
		super.setAnswer(id, value);
	}
	focusBlank(id: string): void {
		this.activeBlankId.set(id);
	}
	useWord(word: string): void {
		const blanks = this.data().blanks;
		const activeId = this.activeBlankId();
		const activeIsEmpty = activeId && !this.answers()[activeId]?.trim();
		const id = activeIsEmpty
			? activeId
			: blanks.find((field) => !this.answers()[field.id]?.trim())?.id;
		if (!id) return;
		this.setAnswer(id, word);
		this.activeBlankId.set(
			blanks.find((field) => !this.answers()[field.id]?.trim())?.id ?? id,
		);
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
