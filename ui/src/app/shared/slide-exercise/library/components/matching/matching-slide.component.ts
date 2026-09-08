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
	MatchingSlideData,
	SlideOption,
} from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import { common, stringMode } from '../../slide-library.component-support';
import { record, requiredText, text } from '../../slide-library.utils';

function parseMatching(value: unknown): MatchingSlideData {
	const source = record(value);
	if (!Array.isArray(source['pairs']) || !source['pairs'].length)
		throw new Error('Matching pairs are required.');
	const pairs = source['pairs'].map((candidate) => {
		const pair = record(candidate, 'matching pair');
		return {
			id: requiredText(pair['id'], 'Matching pair id'),
			left: requiredText(pair['left'], 'Matching left item'),
			right: requiredText(pair['right'], 'Matching right item'),
			rightId: text(pair['rightId']) || undefined,
		};
	});
	if (new Set(pairs.map((pair) => pair.id)).size !== pairs.length)
		throw new Error('Matching pair ids must be unique.');
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'definition',
				'synonym',
				'antonym',
				'collocation',
				'word-family',
				'person-opinion',
				'sentence-ending',
				'heading-section',
				'term-example',
			] as const,
			'definition',
		),
		pairs,
		shuffleRight: source['shuffleRight'] === true,
		feedbackMode:
			source['feedbackMode'] === 'on-complete'
				? 'on-complete'
				: 'immediate',
		allowManyToOne: source['allowManyToOne'] === true,
	};
}

@Component({
	selector: 'app-matching-slide',
	standalone: true,
	imports: [MatButtonModule, SlideStimulusComponent],
	templateUrl: './matching-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchingSlideComponent
	extends ScoredSlideBase<MatchingSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly selectedLeftId = signal('');
	readonly matchedPairIds = signal<readonly string[]>([]);
	readonly pairFeedback = signal('');
	readonly wrongPair = signal<{
		readonly leftId: string;
		readonly rightId: string;
	} | null>(null);
	readonly rightOptions = signal<readonly SlideOption[]>([]);
	load(context: SlideContentContext): void {
		const data = parseMatching(context.data);
		this.begin(context.slideId, data);
		this.selectedLeftId.set('');
		this.matchedPairIds.set([]);
		this.pairFeedback.set('');
		this.wrongPair.set(null);
		const unique = [
			...new Map(
				data.pairs.map((pair) => [
					pair.rightId || pair.id,
					{ id: pair.rightId || pair.id, label: pair.right },
				]),
			).values(),
		];
		this.rightOptions.set(
			data.shuffleRight ? [...unique.slice(1), unique[0]] : unique,
		);
	}
	selectLeft(id: string): void {
		if (this.interactionState() === 'idle' && !this.isMatched(id)) {
			this.selectedLeftId.set(id);
			this.pairFeedback.set('');
			this.wrongPair.set(null);
		}
	}
	selectRight(rightId: string): void {
		const leftId = this.selectedLeftId();
		if (!leftId || this.interactionState() !== 'idle') return;
		const pair = this.data().pairs.find(
			(candidate) => candidate.id === leftId,
		);
		if (!pair) return;
		if ((pair.rightId || pair.id) !== rightId) {
			this.selectedLeftId.set('');
			if (this.data().feedbackMode === 'immediate') {
				this.wrongPair.set({ leftId, rightId });
				this.pairFeedback.set('Those items do not match. Try again.');
				this.events.next({
					type: 'pair-incorrect',
					data: { leftId, rightId },
				});
			} else {
				this.wrongPair.set(null);
				this.pairFeedback.set('');
			}
			return;
		}
		this.matchedPairIds.update((ids) => [...ids, leftId]);
		this.selectedLeftId.set('');
		this.wrongPair.set(null);
		this.pairFeedback.set('Pair matched.');
		this.events.next({ type: 'pair-matched', data: { leftId, rightId } });
		if (this.matchedPairIds().length === this.data().pairs.length)
			this.finish(true, {
				correct: true,
				matchedPairIds: this.matchedPairIds(),
			});
	}
	isMatched(id: string): boolean {
		return this.matchedPairIds().includes(id);
	}
	pairButtonState(id: string): string {
		return this.isMatched(id)
			? 'correct'
			: this.wrongPair()?.leftId === id
				? 'incorrect'
				: this.selectedLeftId() === id
					? 'selected'
					: 'neutral';
	}
	rightButtonState(id: string): string {
		return this.rightLocked(id)
			? 'correct'
			: this.wrongPair()?.rightId === id
				? 'incorrect'
				: 'neutral';
	}
	matchingLeftAriaLabel(id: string, label: string): string {
		const state = this.pairButtonState(id);
		if (state === 'selected') return `${label}, selected`;
		if (state === 'correct') return `${label}, matched`;
		if (state === 'incorrect') return `${label}, incorrect match`;
		return label;
	}
	matchingRightAriaLabel(id: string, label: string): string {
		const state = this.rightButtonState(id);
		if (state === 'correct') return `${label}, matched`;
		if (state === 'incorrect') return `${label}, incorrect match`;
		return label;
	}
	rightLocked(id: string): boolean {
		return (
			this.data().pairs.some(
				(pair) =>
					this.isMatched(pair.id) && (pair.rightId || pair.id) === id,
			) && !this.data().allowManyToOne
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}
