import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	EventEmitter,
	ViewChild,
	signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type {
	NumberInputSlideExpansionHandler,
	SlideContentComponent,
	SlideContentContext,
	SlideContentEvent,
} from '../../../slide-content-contracts';
import type { SlideExerciseRuntimeState } from '../../../slide-exercise.models';
import type { NumberInputSlideData } from '../../slide-library.models';
import { common } from '../../slide-library.component-support';
import { record, requiredText, text } from '../../slide-library.utils';

function finiteNumber(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${label} must be a finite number.`);
	}
	return value;
}

function parseNumberInput(value: unknown): NumberInputSlideData {
	const source = record(value);
	const min = finiteNumber(source['min'], 'Number input min');
	const max = finiteNumber(source['max'], 'Number input max');
	const step = finiteNumber(source['step'], 'Number input step');
	const initialValue = finiteNumber(source['initialValue'], 'Number input initialValue');
	if (max < min) throw new Error('Number input max must be greater than or equal to min.');
	if (step <= 0) throw new Error('Number input step must be greater than zero.');
	if (initialValue < min || initialValue > max) {
		throw new Error('Number input initialValue must be within min and max.');
	}
	const expansionId = text(source['expansionId']);
	if ('expansionId' in source && !expansionId) {
		throw new Error('Number input expansionId is required when configured.');
	}
	return {
		...common(source),
		question: requiredText(source['question'], 'Number input question'),
		label: text(source['label']) || undefined,
		min,
		max,
		step,
		initialValue,
		expansionId: expansionId || undefined,
	};
}

function expansionHandler(value: unknown): NumberInputSlideExpansionHandler | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const candidate = (value as { numberInputExpansion?: unknown }).numberInputExpansion;
	return typeof candidate === 'function' ? candidate as NumberInputSlideExpansionHandler : null;
}

@Component({
	selector: 'app-number-input-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule],
	templateUrl: './number-input-slide.component.html',
	styleUrls: [
		'../../slide-library.component.scss',
		'../../slide-library-language.component.scss',
		'../../slide-library-supporting.component.scss',
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberInputSlideComponent implements SlideContentComponent, AfterViewInit {
	readonly stateChange = new EventEmitter<SlideExerciseRuntimeState>();
	readonly event = new EventEmitter<SlideContentEvent>();
	readonly data = signal<NumberInputSlideData | null>(null);
	readonly value = signal<number | null>(null);
	readonly busy = signal(false);
	@ViewChild('numberInput') private numberInput?: ElementRef<HTMLInputElement>;
	private context: SlideContentContext | null = null;

	load(context: SlideContentContext): void {
		this.context = context;
		const data = parseNumberInput(context.data);
		this.data.set(data);
		this.value.set(data.initialValue);
		this.busy.set(false);
		this.setReady(true);
	}

	ngAfterViewInit(): void {
		this.numberInput?.nativeElement.focus();
	}

	inputFrom(event: Event): string {
		return (event.target as HTMLInputElement | null)?.value ?? '';
	}

	setValue(value: string | number): void {
		if (this.busy()) return;
		const parsed = String(value).trim() ? Number(value) : null;
		this.value.set(parsed !== null && Number.isFinite(parsed) ? parsed : null);
		this.setReady(this.isValid());
	}

	handleAction(actionId: string): void {
		const value = this.value();
		if (actionId !== 'continue' || value === null || !this.isValid() || !this.context?.deck || this.busy()) return;
		if (this.data()?.expansionId) {
			void this.expand(value);
			return;
		}
		this.event.emit({ type: 'submitted', data: { value } });
		this.context.deck.next();
	}

	private isValid(): boolean {
		const data = this.data();
		const value = this.value();
		if (!data || value === null || value < data.min || value > data.max) return false;
		const steps = (value - data.min) / data.step;
		return Math.abs(steps - Math.round(steps)) < Number.EPSILON * 10;
	}

	private async expand(value: number): Promise<void> {
		const context = this.context;
		const expansionId = this.data()?.expansionId;
		if (!context?.deck || !expansionId) return;
		this.busy.set(true);
		this.stateChange.emit({ chrome: { footer: { primary: { disabled: true, loading: true } } } });
		try {
			const handler = expansionHandler(context.environment);
			if (!handler) throw new Error(`Number input expansion is unavailable: ${expansionId}`);
			const result = await handler({ expansionId, slideId: context.slideId, value });
			if (this.context !== context) return;
			if (!result.slides.length) throw new Error('The requested practice has no slides.');
			context.deck.insertSlides({ anchorId: context.slideId, gap: 0, slides: result.slides });
			this.event.emit({ type: 'submitted', data: { value } });
			context.deck.next();
		} catch (error) {
			this.busy.set(false);
			this.stateChange.emit({
				chrome: {
					footer: {
						tone: 'error',
						title: 'Could not continue',
						detail: error instanceof Error ? error.message : 'The requested practice could not be prepared.',
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
