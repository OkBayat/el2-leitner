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
import { ScoredSlideBase } from '../../scored-slide.base';
import type {
	OrderingSlideData,
	SlideOption,
} from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import { common, stringMode } from '../../slide-library.component-support';
import { equalIds, options, record, strings } from '../../slide-library.utils';

function parseOrdering(value: unknown): OrderingSlideData {
	const source = record(value);
	const items = options(source['items'], 'Ordering items');
	const correctOrderIds = strings(source['correctOrderIds']);
	if (
		items.length < 2 ||
		correctOrderIds.length !== items.length ||
		!equalIds(
			items.map((item) => item.id),
			correctOrderIds,
		)
	)
		throw new Error('Ordering answer must contain every item once.');
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'sequence',
				'chronology',
				'severity',
				'adjective-order',
				'process',
			] as const,
			'sequence',
		),
		items,
		correctOrderIds,
	};
}

@Component({
	selector: 'app-ordering-slide',
	standalone: true,
	imports: [MatButtonModule, SlideStimulusComponent],
	templateUrl: './ordering-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderingSlideComponent
	extends ScoredSlideBase<OrderingSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly orderedItems = signal<readonly SlideOption[]>([]);
	load(context: SlideContentContext): void {
		const data = parseOrdering(context.data);
		this.begin(context.slideId, data);
		this.orderedItems.set(data.items);
		this.setReady(true);
	}
	move(id: string, offset: -1 | 1): void {
		if (this.interactionState() !== 'idle') return;
		const items = [...this.orderedItems()];
		const from = items.findIndex((item) => item.id === id);
		const to = from + offset;
		if (from < 0 || to < 0 || to >= items.length) return;
		[items[from], items[to]] = [items[to], items[from]];
		this.orderedItems.set(items);
	}
	orderState(id: string): string {
		if (this.interactionState() === 'idle') return 'neutral';
		const index = this.orderedItems().findIndex((item) => item.id === id);
		return this.data().correctOrderIds[index] === id
			? 'correct'
			: 'incorrect';
	}
	handleAction(actionId: string): void {
		if (actionId !== 'check') return;
		const actual = this.orderedItems().map((item) => item.id);
		const correct = actual.every(
			(id, index) => this.data().correctOrderIds[index] === id,
		);
		this.finish(
			correct,
			{ correct, orderedItemIds: actual },
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}
