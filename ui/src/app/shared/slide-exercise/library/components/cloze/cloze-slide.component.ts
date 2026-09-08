import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
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
	answerMatches,
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
	imports: [MatButtonModule, SlideStimulusComponent],
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
		this.activeBlankId.set(
			data.inputMode === 'select' ? '' : (data.blanks[0]?.id ?? ''),
		);
	}
	blank(id: string | undefined): AnswerField | undefined {
		return this.data().blanks.find((field) => field.id === id);
	}
	blankState(id: string): string {
		const field = this.blank(id);
		return field ? this.fieldState(field) : 'neutral';
	}
	blankSize(field: AnswerField): number {
		const currentLength = this.answers()[field.id]?.length ?? 0;
		const answerLength = Math.max(0, ...field.answers.map((answer) => answer.length));
		return Math.min(24, Math.max(4, currentLength, answerLength) + 1);
	}
	override setAnswer(id: string, value: string): void {
		this.activeBlankId.set(id);
		super.setAnswer(id, value);
	}
	focusBlank(id: string): void {
		if (this.interactionState() !== 'idle') return;
		this.activeBlankId.set(id);
	}
	selectChoice(word: string): void {
		const field =
			this.blank(this.activeBlankId()) ?? this.data().blanks[0];
		if (
			!field ||
			this.interactionState() !== 'idle' ||
			!this.data().wordBank?.includes(word)
		)
			return;
		this.setAnswer(field.id, word);
	}
	choiceState(
		word: string,
	): 'neutral' | 'selected' | 'correct' | 'incorrect' {
		const field = this.blank(this.activeBlankId());
		if (!field) return 'neutral';
		const selected = this.answers()[field.id] === word;
		if (this.interactionState() === 'idle')
			return selected ? 'selected' : 'neutral';
		if (answerMatches(word, field)) return 'correct';
		return selected ? 'incorrect' : 'neutral';
	}
	choiceAriaLabel(word: string, index: number): string {
		const prefix = `${index + 1}. ${word}`;
		const state = this.choiceState(word);
		if (state === 'correct') return `${prefix}, correct answer`;
		if (state === 'incorrect') return `${prefix}, your answer, incorrect`;
		return prefix;
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
