import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { SpeechService } from '../../../../../core/speech/speech.service';
import { LearningStoreService } from '../../../../../core/state/learning-store.service';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import { ScoredSlideBase } from '../../scored-slide.base';
import type {
	ClassificationItem,
	ClassificationSlideData,
} from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import { common, stringMode } from '../../slide-library.component-support';
import {
	options,
	record,
	requiredText,
	shuffled,
} from '../../slide-library.utils';

function parseClassification(value: unknown): ClassificationSlideData {
	const source = record(value);
	const categories = options(
		source['categories'],
		'Classification categories',
	);
	if (categories.length < 2 || !Array.isArray(source['items']))
		throw new Error('Classification categories and items are required.');
	const items = source['items'].map((candidate) => {
		const item = record(candidate, 'classification item');
		return {
			id: requiredText(item['id'], 'Classification item id'),
			label: requiredText(item['label'], 'Classification item label'),
			correctCategoryId: requiredText(
				item['correctCategoryId'],
				'Classification answer',
			),
		};
	});
	if (
		!items.length ||
		items.some(
			(item) =>
				!categories.some(
					(category) => category.id === item.correctCategoryId,
				),
		)
	)
		throw new Error('Classification answers must reference a category.');
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'positive-negative',
				'formal-informal',
				'countable-uncountable',
				'part-of-speech',
				'possible-impossible',
				'linking-word-function',
				'letter-language-function',
				'sound',
				'custom',
			] as const,
			'custom',
		),
		categories,
		items: shuffled(items),
	};
}

@Component({
	selector: 'app-classification-slide',
	standalone: true,
	imports: [
		DragDropModule,
		MatButtonModule,
		MatChipsModule,
		SlideStimulusComponent,
	],
	templateUrl: './classification-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassificationSlideComponent
	extends ScoredSlideBase<ClassificationSlideData>
	implements SlideContentComponent, OnDestroy
{
	private readonly speech = inject(SpeechService);
	private readonly store = inject(LearningStoreService);
	readonly selectedItemId = signal('');
	readonly assignments = signal<Readonly<Record<string, string>>>({});
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseClassification(context.data));
		this.selectedItemId.set('');
		this.assignments.set({});
	}
	selectItem(id: string): void {
		const item = this.data().items.find((candidate) => candidate.id === id);
		if (!item || this.interactionState() !== 'idle') return;
		this.selectedItemId.set(id);
		const rate = this.store.state()?.settings.voiceRate ?? 0.85;
		this.speech.speak(item.label, rate);
	}
	assignSelected(categoryId: string): void {
		const id = this.selectedItemId();
		this.assignItem(id, categoryId);
	}
	assignDropped(itemId: string, categoryId: string): void {
		this.assignItem(itemId, categoryId);
	}
	private assignItem(itemId: string, categoryId: string): void {
		if (
			this.interactionState() !== 'idle' ||
			!this.data().items.some((item) => item.id === itemId) ||
			!this.data().categories.some((category) => category.id === categoryId)
		)
			return;
		this.assignments.update((value) => ({ ...value, [itemId]: categoryId }));
		this.selectedItemId.set('');
		this.setReady(
			Object.keys(this.assignments()).length === this.data().items.length,
		);
	}
	assignedItems(categoryId: string): readonly ClassificationItem[] {
		return this.data().items.filter(
			(item) => this.assignments()[item.id] === categoryId,
		);
	}
	selectedItemLabel(): string {
		return (
			this.data().items.find((item) => item.id === this.selectedItemId())
				?.label ?? ''
		);
	}
	handleBucketKeydown(event: KeyboardEvent, categoryId: string): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		this.assignSelected(categoryId);
	}
	assignmentState(id: string): string {
		if (this.interactionState() === 'idle')
			return this.selectedItemId() === id
				? 'selected'
				: this.assignments()[id]
					? 'assigned'
					: 'neutral';
		return this.assignments()[id] ===
			this.data().items.find((item) => item.id === id)?.correctCategoryId
			? 'correct'
			: 'incorrect';
	}
	itemState(id: string): string {
		return this.assignmentState(id);
	}
	classificationItemAriaLabel(id: string, label: string): string {
		const state = this.assignmentState(id);
		if (state === 'selected') return `${label}, selected`;
		const assignedCategoryId = this.assignments()[id];
		const assignedCategory = this.data().categories.find(
			(category) => category.id === assignedCategoryId,
		)?.label;
		if (state === 'assigned')
			return `${label}, assigned to ${assignedCategory}`;
		if (state === 'correct')
			return `${label}, correctly assigned to ${assignedCategory}`;
		if (state === 'incorrect') {
			const correctCategoryId = this.data().items.find(
				(item) => item.id === id,
			)?.correctCategoryId;
			const correctCategory = this.data().categories.find(
				(category) => category.id === correctCategoryId,
			)?.label;
			return `${label}, assigned to ${assignedCategory}, incorrect; correct category ${correctCategory}`;
		}
		return label;
	}
	classificationBucketAriaLabel(categoryId: string, label: string): string {
		const selectedItem = this.data().items.find(
			(item) => item.id === this.selectedItemId(),
		)?.label;
		return selectedItem
			? `Assign ${selectedItem} to ${label}`
			: `Assign selected item to ${label}`;
	}
	handleAction(actionId: string): void {
		if (
			actionId !== 'check' ||
			Object.keys(this.assignments()).length !== this.data().items.length
		)
			return;
		const correct = this.data().items.every(
			(item) => this.assignments()[item.id] === item.correctCategoryId,
		);
		this.finish(
			correct,
			{ correct, assignments: this.assignments() },
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.speech.cancel();
		this.destroy();
	}
}
