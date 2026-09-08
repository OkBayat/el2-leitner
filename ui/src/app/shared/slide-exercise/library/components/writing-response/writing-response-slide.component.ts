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
import type { WritingResponseSlideData } from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import {
	common,
	inputValue,
	stringMode,
} from '../../slide-library.component-support';
import {
	record,
	requiredText,
	strings,
	text,
	wordCount,
} from '../../slide-library.utils';

function parseWriting(value: unknown): WritingResponseSlideData {
	const source = record(value);
	const timerSeconds = Number(source['timerSeconds']);
	const minimum = Number(source['recommendedMinimumWords']);
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'sentence',
				'paragraph',
				'task1-chart',
				'task1-process',
				'task2-essay',
				'general-letter',
			] as const,
			'sentence',
		),
		prompt: requiredText(source['prompt'], 'Writing prompt'),
		timerSeconds:
			Number.isInteger(timerSeconds) && timerSeconds > 0
				? timerSeconds
				: undefined,
		recommendedMinimumWords:
			Number.isInteger(minimum) && minimum > 0 ? minimum : undefined,
		targetVocabulary: strings(source['targetVocabulary']),
		planningNotes: source['planningNotes'] === true,
		modelAnswer: text(source['modelAnswer']) || undefined,
		register: stringMode(
			source['register'],
			['formal', 'informal', 'neutral'] as const,
			'neutral',
		),
	};
}

@Component({
	selector: 'app-writing-response-slide',
	standalone: true,
	imports: [
		MatChipsModule,
		MatFormFieldModule,
		MatInputModule,
		SlideStimulusComponent,
	],
	templateUrl: './writing-response-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WritingResponseSlideComponent
	extends ScoredSlideBase<WritingResponseSlideData>
	implements SlideContentComponent, OnDestroy
{
	private timer: ReturnType<typeof setInterval> | null = null;
	readonly response = signal('');
	readonly notes = signal('');
	readonly remainingSeconds = signal(0);
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	wordCount(): number {
		return wordCount(this.response());
	}
	load(context: SlideContentContext): void {
		const data = parseWriting(context.data);
		this.clearTimer();
		this.begin(context.slideId, data, 'submit');
		this.response.set('');
		this.notes.set('');
		this.remainingSeconds.set(data.timerSeconds ?? 0);
		if (data.timerSeconds)
			this.timer = setInterval(() => {
				this.remainingSeconds.update((value) => Math.max(0, value - 1));
				if (!this.remainingSeconds()) this.clearTimer();
			}, 1000);
	}
	setResponse(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.response.set(value);
		this.setReady(Boolean(value.trim()), 'submit');
	}
	handleAction(actionId: string): void {
		if (actionId !== 'submit' || !this.response().trim()) return;
		this.clearTimer();
		this.submit(
			{
				response: this.response(),
				notes: this.notes(),
				wordCount: this.wordCount(),
				mode: this.data().mode,
				register: this.data().register,
			},
			this.data().modelAnswer
				? 'Compare your response with the model answer.'
				: '',
		);
	}
	private clearTimer(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
	ngOnDestroy(): void {
		this.clearTimer();
		this.destroy();
	}
}
