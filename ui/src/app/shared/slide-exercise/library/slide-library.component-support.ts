import { signal } from '@angular/core';
import type { AnswerField, SlideStimulus } from './slide-library.models';
import { ScoredSlideBase } from './scored-slide.base';
import { answerMatches, parseStimulus, text } from './slide-library.utils';

export interface CommonData {
	readonly instruction?: string;
	readonly explanation?: string;
	readonly stimulus?: SlideStimulus;
}

export function common(source: Record<string, unknown>): CommonData {
	return {
		instruction: text(source['instruction']) || undefined,
		explanation: text(source['explanation']) || undefined,
		stimulus: parseStimulus(source['stimulus']),
	};
}

export function stringMode<T extends string>(
	value: unknown,
	allowed: readonly T[],
	fallback: T,
): T {
	const candidate = text(value) as T;
	if (!candidate) return fallback;
	if (!allowed.includes(candidate))
		throw new Error(`Unsupported slide mode: ${candidate}`);
	return candidate;
}

export function inputValue(event: Event): string {
	return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
}

export abstract class AnswerFieldsSlideBase<
	TData extends CommonData,
> extends ScoredSlideBase<TData> {
	readonly answers = signal<Readonly<Record<string, string>>>({});
	abstract fields(): readonly AnswerField[];
	readonly defaultInstruction = 'Complete every field.';
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	wordLimitLabel(field: AnswerField): string {
		return field.wordLimit === 1
			? 'ONE WORD ONLY'
			: `NO MORE THAN ${field.wordLimit} WORDS`;
	}
	setAnswer(id: string, value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.answers.update((answers) => ({ ...answers, [id]: value }));
		this.setReady(
			this.fields().every((field) =>
				Boolean(this.answers()[field.id]?.trim()),
			),
		);
	}
	fieldState(field: AnswerField): string {
		if (this.interactionState() === 'idle') return 'neutral';
		return answerMatches(this.answers()[field.id] ?? '', field)
			? 'correct'
			: 'incorrect';
	}
	protected checkFields(): void {
		const fields = this.fields();
		const fieldResults = Object.fromEntries(
			fields.map((field) => [
				field.id,
				answerMatches(this.answers()[field.id] ?? '', field),
			]),
		);
		const correct = Object.values(fieldResults).every(Boolean);
		this.finish(
			correct,
			{ correct, answers: this.answers(), fieldResults },
			this.data().explanation ?? '',
		);
	}
}
