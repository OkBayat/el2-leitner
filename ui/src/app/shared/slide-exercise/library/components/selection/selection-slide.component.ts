import { ChangeDetectionStrategy, Component, EventEmitter, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type {
	SlideContentComponent,
	SlideContentContext,
	SlideContentEvent,
	SelectionSlideExpansionHandler,
} from '../../../slide-content-contracts';
import type {
	SlideExerciseRuntimeState,
} from '../../../slide-exercise.models';
import type {
	SelectionSlideData,
	SelectionSlideMode,
	SlideOption,
} from '../../slide-library.models';
import { common } from '../../slide-library.component-support';
import { options, record, requiredText, text } from '../../slide-library.utils';

const SELECTION_MODES = ['single', 'multiple'] as const;

function parseSelection(value: unknown): SelectionSlideData {
	const source = record(value);
	const parsedOptions = options(source['options']);
	if (parsedOptions.length < 2) {
		throw new Error('Selection slide requires at least two options.');
	}
	const mode = requiredText(source['mode'], 'Selection mode');
	if (!SELECTION_MODES.includes(mode as SelectionSlideMode)) {
		throw new Error('Selection mode must be single or multiple.');
	}
	const expansionId = text(source['expansionId']);
	if ('expansionId' in source && !expansionId) {
		throw new Error('Selection expansionId is required when configured.');
	}
	return {
		...common(source),
		mode: mode as SelectionSlideMode,
		question: requiredText(source['question'], 'Selection question'),
		options: parsedOptions,
		expansionId: expansionId || undefined,
	};
}

function expansionHandler(value: unknown): SelectionSlideExpansionHandler | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const candidate = (value as { selectionExpansion?: unknown }).selectionExpansion;
	return typeof candidate === 'function'
		? candidate as SelectionSlideExpansionHandler
		: null;
}

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message
		? error.message
		: 'The selected practice could not be prepared.';
}

@Component({
	selector: 'app-selection-slide',
	standalone: true,
	imports: [MatButtonModule],
	templateUrl: './selection-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionSlideComponent implements SlideContentComponent {
	readonly stateChange = new EventEmitter<SlideExerciseRuntimeState>();
	readonly event = new EventEmitter<SlideContentEvent>();
	readonly data = signal<SelectionSlideData | null>(null);
	readonly selectedOptionIds = signal<readonly string[]>([]);
	readonly busy = signal(false);
	private context: SlideContentContext | null = null;

	load(context: SlideContentContext): void {
		this.context = context;
		this.data.set(parseSelection(context.data));
		this.selectedOptionIds.set([]);
		this.busy.set(false);
		this.setReady(false);
	}

	handleShortcut(key: string): void {
		const option = this.data()?.options[Number(key) - 1];
		if (option) this.selectOption(option.id);
	}

	selectOption(optionId: string): void {
		const data = this.data();
		if (this.busy() || !data?.options.some((option) => option.id === optionId)) return;
		this.selectedOptionIds.update((selected) => data.mode === 'single'
			? [optionId]
			: selected.includes(optionId)
				? selected.filter((id) => id !== optionId)
				: [...selected, optionId]);
		this.setReady(this.selectedOptionIds().length > 0);
	}

	isSelected(optionId: string): boolean {
		return this.selectedOptionIds().includes(optionId);
	}

	optionAriaLabel(option: SlideOption, index: number): string {
		return [`${index + 1}. ${option.label}`, option.description]
			.filter(Boolean)
			.join('. ');
	}

	handleAction(actionId: string): void {
		const selectedOptionIds = this.selectedOptionIds();
		if (actionId !== 'continue' || !selectedOptionIds.length || !this.context?.deck || this.busy()) return;
		if (this.data()?.expansionId) {
			void this.expand(selectedOptionIds);
			return;
		}
		this.event.emit({ type: 'submitted', data: { selectedOptionIds } });
		this.context.deck.next();
	}

	private async expand(selectedOptionIds: readonly string[]): Promise<void> {
		const context = this.context;
		const expansionId = this.data()?.expansionId;
		if (!context?.deck || !expansionId) return;
		this.busy.set(true);
		this.stateChange.emit({
			chrome: { footer: { primary: { disabled: true, loading: true } } },
		});
		try {
			const handler = expansionHandler(context.environment);
			if (!handler) throw new Error(`Selection expansion is unavailable: ${expansionId}`);
			const result = await handler({ expansionId, slideId: context.slideId, selectedOptionIds });
			if (this.context !== context) return;
			if (!result.slides.length) throw new Error('The selected practice has no slides.');
			context.deck.insertSlides({ anchorId: context.slideId, gap: 0, slides: result.slides });
			this.event.emit({ type: 'submitted', data: { selectedOptionIds } });
			context.deck.next();
		} catch (error) {
			this.busy.set(false);
			this.stateChange.emit({
				chrome: {
					footer: {
						tone: 'error',
						title: 'Could not continue',
						detail: errorMessage(error),
						primary: { disabled: false, loading: false },
					},
				},
			});
		}
	}

	private setReady(ready: boolean): void {
		this.stateChange.emit({ chrome: { footer: { primary: { disabled: !ready } } } });
	}
}
