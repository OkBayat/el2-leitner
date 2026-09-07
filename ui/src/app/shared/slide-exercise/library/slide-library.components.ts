import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ReviewAnswerSoundService } from '../../../core/sound/review-answer-sound.service';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../slide-content-contracts';
import { LocalAudioRecorderService } from './local-audio-recorder.service';
import { ScoredSlideBase } from './scored-slide.base';
import { SlideStimulusComponent } from './slide-stimulus.component';
import type {
	AnswerField,
	ChoiceSlideData,
	ClassificationSlideData,
	ClozeSlideData,
	DictationSlideData,
	ErrorCorrectionSlideData,
	MatchingSlideData,
	OrderingSlideData,
	RewriteSlideData,
	ShortAnswerSlideData,
	SlideOption,
	SlideStimulus,
	SpeakingResponseSlideData,
	StructuredCompletionSlideData,
	TruthSlideData,
	WordFormationSlideData,
	WritingResponseSlideData,
} from './slide-library.models';
import {
	answerFields,
	answerMatches,
	equalIds,
	normalizeAnswer,
	options,
	parseStimulus,
	record,
	requiredText,
	strings,
	text,
	wordCount,
} from './slide-library.utils';

interface CommonData {
	readonly instruction?: string;
	readonly explanation?: string;
	readonly stimulus?: SlideStimulus;
}

function common(source: Record<string, unknown>): CommonData {
	return {
		instruction: text(source['instruction']) || undefined,
		explanation: text(source['explanation']) || undefined,
		stimulus: parseStimulus(source['stimulus']),
	};
}

function stringMode<T extends string>(
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

function inputValue(event: Event): string {
	return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
}

const CHOICE_MODES = [
	'single',
	'multiple',
	'meaning',
	'part-of-speech',
	'synonym',
	'antonym',
	'correct-spelling',
	'best-word',
	'odd-one-out',
] as const;

function parseChoice(value: unknown): ChoiceSlideData {
	const source = record(value);
	const parsedOptions = options(source['options']);
	const correctOptionIds = strings(source['correctOptionIds']);
	if (
		parsedOptions.length < 2 ||
		!correctOptionIds.length ||
		correctOptionIds.some(
			(id) => !parsedOptions.some((option) => option.id === id),
		)
	) {
		throw new Error('Choice slide requires valid options and answers.');
	}
	const mode = stringMode(source['mode'], CHOICE_MODES, 'single');
	if (mode !== 'multiple' && correctOptionIds.length !== 1)
		throw new Error('Single-choice slides require one correct option.');
	return {
		...common(source),
		mode,
		question: requiredText(source['question'], 'Choice question'),
		options: parsedOptions,
		correctOptionIds,
	};
}

const CHOICE_TEMPLATE = `
  @if (content(); as data) {
    <article class="slide-type" data-testid="choice-slide">
      @if (data.stimulus) { <app-slide-stimulus [stimulus]="data.stimulus" /> }
      <section class="slide-interaction">
        <p class="slide-instruction">{{ data.instruction || (data.mode === 'multiple' ? 'Choose all correct answers.' : 'Choose one answer.') }}</p>
        <h1>{{ data.question }}</h1>
        <div class="choice-grid" [attr.role]="data.mode === 'multiple' ? 'group' : 'radiogroup'" aria-label="Answer options">
          @for (option of data.options; track option.id; let index = $index) {
            <button mat-stroked-button type="button" class="choice-option" [attr.data-state]="optionState(option.id)"
              [attr.role]="data.mode === 'multiple' ? 'checkbox' : 'radio'" [attr.aria-checked]="isSelected(option.id)"
              [disabled]="interactionState() !== 'idle'" (click)="selectOption(option.id)">
              <span class="choice-option__content">
                <span class="choice-option__number" aria-hidden="true">{{ index + 1 }}</span>
                <span>{{ option.label }}</span>
              </span>
            </button>
          }
        </div>
      </section>
    </article>
  }
`;

@Component({
	selector: 'app-choice-slide',
	standalone: true,
	imports: [MatButtonModule, SlideStimulusComponent],
	template: CHOICE_TEMPLATE,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChoiceSlideComponent
	extends ScoredSlideBase<ChoiceSlideData>
	implements SlideContentComponent, OnDestroy
{
	private readonly answerSound = inject(ReviewAnswerSoundService);
	readonly selectedOptionIds = signal<readonly string[]>([]);

	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseChoice(context.data));
		this.selectedOptionIds.set([]);
	}

	handleShortcut(key: string): void {
		const option = this.data().options[Number(key) - 1];
		if (option) this.selectOption(option.id);
	}

	selectOption(optionId: string): void {
		const data = this.data();
		if (
			this.interactionState() !== 'idle' ||
			!data.options.some((option) => option.id === optionId)
		)
			return;
		if (data.mode === 'multiple') {
			this.selectedOptionIds.update((ids) =>
				ids.includes(optionId)
					? ids.filter((id) => id !== optionId)
					: [...ids, optionId],
			);
		} else {
			this.selectedOptionIds.set([optionId]);
		}
		this.setReady(this.selectedOptionIds().length > 0);
	}

	isSelected(optionId: string): boolean {
		return this.selectedOptionIds().includes(optionId);
	}

	optionState(
		optionId: string,
	): 'neutral' | 'selected' | 'correct' | 'incorrect' {
		if (this.interactionState() === 'idle')
			return this.isSelected(optionId) ? 'selected' : 'neutral';
		if (this.data().correctOptionIds.includes(optionId)) return 'correct';
		return this.isSelected(optionId) ? 'incorrect' : 'neutral';
	}

	handleAction(actionId: string): void {
		if (
			actionId !== 'check' ||
			this.interactionState() !== 'idle' ||
			!this.selectedOptionIds().length
		)
			return;
		const selectedOptionIds = this.selectedOptionIds();
		const correctOptionIds = this.data().correctOptionIds;
		const correct = equalIds(selectedOptionIds, correctOptionIds);
		this.answerSound.play(correct ? 'correct' : 'incorrect');
		this.finish(
			correct,
			{ selectedOptionIds, correctOptionIds, correct },
			this.data().explanation ?? '',
		);
	}

	ngOnDestroy(): void {
		this.answerSound.stop();
		this.destroy();
	}
}

const TRUTH_OPTIONS: Record<TruthSlideData['mode'], readonly SlideOption[]> = {
	'true-false': [
		{ id: 'true', label: 'True' },
		{ id: 'false', label: 'False' },
	],
	'true-false-not-given': [
		{ id: 'true', label: 'True' },
		{ id: 'false', label: 'False' },
		{ id: 'not-given', label: 'Not Given' },
	],
	'yes-no-not-given': [
		{ id: 'yes', label: 'Yes' },
		{ id: 'no', label: 'No' },
		{ id: 'not-given', label: 'Not Given' },
	],
	'agree-disagree': [
		{ id: 'agree', label: 'Agree' },
		{ id: 'disagree', label: 'Disagree' },
	],
};

@Component({
	selector: 'app-truth-slide',
	standalone: true,
	imports: [MatButtonModule, SlideStimulusComponent],
	template: CHOICE_TEMPLATE,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TruthSlideComponent extends ChoiceSlideComponent {
	override load(context: SlideContentContext): void {
		const source = record(context.data);
		const mode = stringMode(
			source['mode'],
			Object.keys(TRUTH_OPTIONS) as TruthSlideData['mode'][],
			'true-false',
		);
		const truthOptions = source['options']
			? options(source['options'])
			: TRUTH_OPTIONS[mode];
		super.load({
			...context,
			data: {
				...common(source),
				mode: 'single',
				question: requiredText(source['statement'], 'Truth statement'),
				options: truthOptions,
				correctOptionIds: [
					requiredText(source['correctOptionId'], 'Truth answer'),
				],
			},
		});
	}
}

interface TeachingBlock {
	readonly kind:
		'word' | 'comparison' | 'correction' | 'patterns' | 'example' | 'note';
	readonly title?: string;
	readonly content: string;
	readonly secondary?: string;
}

interface TeachingCardData extends CommonData {
	readonly mode: 'word' | 'usage' | 'contrast' | 'rule' | 'warning' | 'tip';
	readonly title: string;
	readonly blocks: readonly TeachingBlock[];
}

@Component({
	selector: 'app-teaching-card-slide',
	standalone: true,
	imports: [SlideStimulusComponent],
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="teaching-card-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Learn' }}
				</p>
				<h1>{{ data.title }}</h1>
				<div class="teaching-grid">
					@for (block of data.blocks; track $index) {
						<section
							class="teaching-block"
							[attr.data-kind]="block.kind"
						>
							@if (block.title) {
								<h2>{{ block.title }}</h2>
							}
							<p>{{ block.content }}</p>
							@if (block.secondary) {
								<p class="text-secondary">
									{{ block.secondary }}
								</p>
							}
						</section>
					}
				</div>
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeachingCardSlideComponent implements SlideContentComponent {
	readonly content = signal<TeachingCardData | null>(null);
	load(context: SlideContentContext): void {
		const source = record(context.data);
		const blocks = Array.isArray(source['blocks'])
			? source['blocks'].map((candidate) => {
					const block = record(candidate, 'teaching block');
					return {
						kind: stringMode(
							block['kind'],
							[
								'word',
								'comparison',
								'correction',
								'patterns',
								'example',
								'note',
							] as const,
							'note',
						),
						title: text(block['title']) || undefined,
						content: requiredText(
							block['content'],
							'Teaching block content',
						),
						secondary: text(block['secondary']) || undefined,
					} satisfies TeachingBlock;
				})
			: [];
		if (!blocks.length)
			throw new Error('Teaching card blocks are required.');
		this.content.set({
			...common(source),
			mode: stringMode(
				source['mode'],
				[
					'word',
					'usage',
					'contrast',
					'rule',
					'warning',
					'tip',
				] as const,
				'word',
			),
			title: requiredText(source['title'], 'Teaching card title'),
			blocks,
		});
	}
}

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
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="matching-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Match the items.' }}
				</p>
				<div class="matching-grid">
					<div class="matching-column" aria-label="Items to match">
						@for (pair of data.pairs; track pair.id) {
							<button
								mat-stroked-button
								type="button"
								[attr.data-state]="pairButtonState(pair.id)"
								[disabled]="isMatched(pair.id)"
								(click)="selectLeft(pair.id)"
							>
								{{ pair.left }}
							</button>
						}
					</div>
					<div class="matching-column" aria-label="Possible matches">
						@for (option of rightOptions(); track option.id) {
							<button
								mat-stroked-button
								type="button"
								[attr.data-state]="rightButtonState(option.id)"
								[disabled]="rightLocked(option.id)"
								(click)="selectRight(option.id)"
							>
								{{ option.label }}
							</button>
						}
					</div>
				</div>
				<p class="feedback-reserve" aria-live="polite">
					{{ pairFeedback() }}
				</p>
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchingSlideComponent
	extends ScoredSlideBase<MatchingSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly selectedLeftId = signal('');
	readonly matchedPairIds = signal<readonly string[]>([]);
	readonly pairFeedback = signal('');
	readonly wrongPair = signal<{ readonly leftId: string; readonly rightId: string } | null>(null);
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
			this.wrongPair.set({ leftId, rightId });
			this.pairFeedback.set('Those items do not match. Try again.');
			this.events.next({
				type: 'pair-incorrect',
				data: { leftId, rightId },
			});
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
		items,
	};
}

@Component({
	selector: 'app-classification-slide',
	standalone: true,
	imports: [MatButtonModule, MatChipsModule, SlideStimulusComponent],
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="classification-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Place each item in a category.' }}
				</p>
				<div class="chip-list" aria-label="Items to classify">
					@for (item of data.items; track item.id) {
						<button
							mat-stroked-button
							type="button"
							[attr.data-state]="itemState(item.id)"
							[disabled]="interactionState() !== 'idle'"
							(click)="selectItem(item.id)"
						>
							{{ item.label }}
						</button>
					}
				</div>
				<div class="bucket-grid">
					@for (category of data.categories; track category.id) {
						<button
							mat-stroked-button
							type="button"
							class="bucket"
							[disabled]="
								!selectedItemId() ||
								interactionState() !== 'idle'
							"
							(click)="assignSelected(category.id)"
						>
							<strong>{{ category.label }}</strong
							><span>{{ assignedLabels(category.id) }}</span>
						</button>
					}
				</div>
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassificationSlideComponent
	extends ScoredSlideBase<ClassificationSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly selectedItemId = signal('');
	readonly assignments = signal<Readonly<Record<string, string>>>({});
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseClassification(context.data));
		this.selectedItemId.set('');
		this.assignments.set({});
	}
	selectItem(id: string): void {
		if (this.interactionState() === 'idle') this.selectedItemId.set(id);
	}
	assignSelected(categoryId: string): void {
		const id = this.selectedItemId();
		if (!id || this.interactionState() !== 'idle') return;
		this.assignments.update((value) => ({ ...value, [id]: categoryId }));
		this.selectedItemId.set('');
		this.setReady(
			Object.keys(this.assignments()).length === this.data().items.length,
		);
	}
	assignedLabels(categoryId: string): string {
		return this.data()
			.items.filter((item) => this.assignments()[item.id] === categoryId)
			.map((item) => item.label)
			.join(', ');
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
		this.destroy();
	}
}

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
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="ordering-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Put the items in order.' }}
				</p>
				<ol class="ordering-list">
					@for (
						item of orderedItems();
						track item.id;
						let first = $first;
						let last = $last
					) {
						<li [attr.data-state]="orderState(item.id)">
							<span>{{ item.label }}</span
							><span class="ordering-actions"
								><button
									mat-icon-button
									type="button"
									[disabled]="
										first || interactionState() !== 'idle'
									"
									[attr.aria-label]="
										'Move ' + item.label + ' up'
									"
									(click)="move(item.id, -1)"
								>
									↑</button
								><button
									mat-icon-button
									type="button"
									[disabled]="
										last || interactionState() !== 'idle'
									"
									[attr.aria-label]="
										'Move ' + item.label + ' down'
									"
									(click)="move(item.id, 1)"
								>
									↓
								</button></span
							>
						</li>
					}
				</ol>
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
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

const FIELD_TEMPLATE = `
  @if (content(); as data) { <article class="slide-type" data-testid="field-slide">@if (data.stimulus) { <app-slide-stimulus [stimulus]="data.stimulus" /> }<section class="slide-interaction"><p class="slide-instruction">{{ data.instruction || defaultInstruction }}</p>
    <div class="field-list">@for (field of fields(); track field.id) { <mat-form-field appearance="outline" [attr.data-state]="fieldState(field)"><mat-label>{{ field.label || field.id }}</mat-label><input matInput [value]="answers()[field.id] || ''" [disabled]="interactionState() !== 'idle'" (input)="setAnswer(field.id, inputFrom($event))" />@if (field.wordLimit) { <mat-hint>Maximum {{ field.wordLimit }} word{{ field.wordLimit === 1 ? '' : 's' }}</mat-hint> }</mat-form-field> }</div>
    @if (interactionState() !== 'idle' && data.explanation) { <p class="slide-explanation">{{ data.explanation }}</p> }
  </section></article> }
`;

abstract class AnswerFieldsSlideBase<
	TData extends CommonData,
> extends ScoredSlideBase<TData> {
	readonly answers = signal<Readonly<Record<string, string>>>({});
	abstract fields(): readonly AnswerField[];
	readonly defaultInstruction = 'Complete every field.';
	inputFrom(event: Event): string {
		return inputValue(event);
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
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="cloze-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Complete the gaps.' }}
				</p>
				<p class="cloze-content">
					@for (segment of segments(); track $index) {
						@if (segment.text) {
							<span>{{ segment.text }}</span>
						} @else if (blank(segment.fieldId); as field) {
							<span
								class="inline-field"
								[attr.data-state]="blankState(field.id)"
							>
								@if (data.inputMode === 'select') {
									<mat-form-field appearance="outline"
										><mat-label>{{
											field.label || 'Answer'
										}}</mat-label
										><mat-select
											[value]="answers()[field.id] || ''"
											[disabled]="
												interactionState() !== 'idle'
											"
											(selectionChange)="
												setAnswer(
													field.id,
													$event.value
												)
											"
										>
											@for (
												word of data.wordBank ?? [];
												track word
											) {
												<mat-option [value]="word">{{
													word
												}}</mat-option>
											}
										</mat-select></mat-form-field
									>
								} @else {
									<mat-form-field appearance="outline"
										><mat-label>{{
											field.label || 'Answer'
										}}</mat-label
										><input
											matInput
											[value]="answers()[field.id] || ''"
											[disabled]="
												interactionState() !== 'idle'
											"
											(input)="
												setAnswer(
													field.id,
													inputFrom($event)
												)
											"
									/></mat-form-field>
								}
							</span>
						}
					}
				</p>
				@if (data.inputMode === 'word-bank') {
					<div class="chip-list" aria-label="Word bank">
						@for (word of data.wordBank ?? []; track word) {
							<button
								mat-stroked-button
								type="button"
								(click)="useWord(word)"
								[disabled]="interactionState() !== 'idle'"
							>
								{{ word }}
							</button>
						}
					</div>
				}
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
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
	useWord(word: string): void {
		const id =
			this.activeBlankId() ||
			this.data().blanks.find((field) => !this.answers()[field.id])?.id;
		if (id) this.setAnswer(id, word);
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
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="structured-completion-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Complete the information.' }}
				</p>
				@if (data.title) {
					<h1>{{ data.title }}</h1>
				}
				@if (data.layout === 'table' && data.rows?.length) {
					<div class="table-scroll">
						<table>
							<thead>
								<tr>
									@for (
										column of data.columns ?? [];
										track column
									) {
										<th scope="col">{{ column }}</th>
									}
								</tr>
							</thead>
							<tbody>
								@for (row of data.rows; track row.id) {
									<tr>
										@for (cell of row.cells; track $index) {
											<td>
												@if (
													cell.fieldId &&
														field(cell.fieldId);
													as answerField
												) {
													<mat-form-field
														appearance="outline"
														[attr.data-state]="
															fieldState(
																answerField
															)
														"
														><mat-label>{{
															answerField.label ||
																'Answer'
														}}</mat-label
														><input
															matInput
															[value]="
																answers()[
																	answerField
																		.id
																] || ''
															"
															[disabled]="
																interactionState() !==
																'idle'
															"
															(input)="
																setAnswer(
																	answerField.id,
																	inputFrom(
																		$event
																	)
																)
															"
													/></mat-form-field>
												} @else {
													{{ cell.text }}
												}
											</td>
										}
									</tr>
								}
							</tbody>
						</table>
					</div>
				} @else {
					<div
						class="structured-fields"
						[attr.data-layout]="data.layout"
					>
						@for (
							answerField of data.fields;
							track answerField.id
						) {
							<mat-form-field
								appearance="outline"
								[attr.data-state]="fieldState(answerField)"
								><mat-label>{{
									answerField.label || answerField.id
								}}</mat-label
								><input
									matInput
									[value]="answers()[answerField.id] || ''"
									[disabled]="interactionState() !== 'idle'"
									(input)="
										setAnswer(
											answerField.id,
											inputFrom($event)
										)
									"
							/></mat-form-field>
						}
					</div>
				}
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
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

function parseShortAnswer(value: unknown): ShortAnswerSlideData {
	const source = record(value);
	const answers = strings(source['answers']);
	if (!answers.length) throw new Error('Short-answer answers are required.');
	const characterCount = Number(source['characterCount']);
	return {
		...common(source),
		question: requiredText(source['question'], 'Short-answer question'),
		answers,
		firstLetterHint: text(source['firstLetterHint']) || undefined,
		characterCount:
			Number.isInteger(characterCount) && characterCount > 0
				? characterCount
				: undefined,
		exactSpelling: source['exactSpelling'] === true,
	};
}

@Component({
	selector: 'app-short-answer-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule, SlideStimulusComponent],
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="short-answer-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Write a short answer.' }}
				</p>
				<h1>{{ data.question }}</h1>
				<div class="hint-row">
					@if (data.firstLetterHint) {
						<span>Starts with {{ data.firstLetterHint }}</span>
					}
					@if (data.characterCount) {
						<span>{{ data.characterCount }} characters</span>
					}
				</div>
				<mat-form-field
					appearance="outline"
					[attr.data-state]="answerState()"
					><mat-label>Answer</mat-label
					><input
						matInput
						[value]="answer()"
						[disabled]="interactionState() !== 'idle'"
						(input)="setAnswer(inputFrom($event))"
				/></mat-form-field>
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortAnswerSlideComponent
	extends ScoredSlideBase<ShortAnswerSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly answer = signal('');
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseShortAnswer(context.data));
		this.answer.set('');
	}
	setAnswer(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.answer.set(value);
		this.setReady(Boolean(value.trim()));
	}
	private correct(): boolean {
		const data = this.data();
		return answerMatches(this.answer(), {
			answers: data.answers,
			caseSensitive: data.exactSpelling,
			punctuationSensitive: data.exactSpelling,
		});
	}
	answerState(): string {
		return this.interactionState() === 'idle'
			? 'neutral'
			: this.correct()
				? 'correct'
				: 'incorrect';
	}
	handleAction(actionId: string): void {
		if (actionId !== 'check' || !this.answer().trim()) return;
		const correct = this.correct();
		this.finish(
			correct,
			{ answer: this.answer(), correct },
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}

function parseWordFormation(value: unknown): WordFormationSlideData {
	const source = record(value);
	const baseFields = answerFields(source['fields']);
	const rawFields = source['fields'] as readonly unknown[];
	const fields = baseFields.map((field, index) => ({
		...field,
		partOfSpeech: requiredText(
			record(rawFields[index], 'word-formation field')['partOfSpeech'],
			'Part of speech',
		),
	}));
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'family',
				'target-part-of-speech',
				'prefix',
				'suffix',
				'negative-form',
				'base-word',
				'transitive-intransitive',
			] as const,
			'family',
		),
		baseWord: requiredText(source['baseWord'], 'Base word'),
		fields,
	};
}

@Component({
	selector: 'app-word-formation-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule, SlideStimulusComponent],
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="word-formation-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Complete the word family.' }}
				</p>
				<h1>{{ data.baseWord }}</h1>
				<div class="word-family-grid">
					@for (field of data.fields; track field.id) {
						<mat-form-field
							appearance="outline"
							[attr.data-state]="fieldState(field)"
							><mat-label>{{ field.partOfSpeech }}</mat-label
							><input
								matInput
								[value]="answers()[field.id] || ''"
								[disabled]="interactionState() !== 'idle'"
								(input)="
									setAnswer(field.id, inputFrom($event))
								"
						/></mat-form-field>
					}
				</div>
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordFormationSlideComponent
	extends AnswerFieldsSlideBase<WordFormationSlideData>
	implements SlideContentComponent, OnDestroy
{
	fields(): readonly AnswerField[] {
		return this.data().fields;
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseWordFormation(context.data));
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

function parseErrorCorrection(value: unknown): ErrorCorrectionSlideData {
	const source = record(value);
	const answers = strings(source['answers']);
	if (!answers.length) throw new Error('Correction answers are required.');
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'select-and-replace',
				'inline-edit',
				'sentence-correction',
				'paragraph-correction',
			] as const,
			'sentence-correction',
		),
		category: text(source['category']) || undefined,
		original: requiredText(source['original'], 'Original text'),
		answers,
	};
}

@Component({
	selector: 'app-error-correction-slide',
	standalone: true,
	imports: [MatFormFieldModule, MatInputModule, SlideStimulusComponent],
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="error-correction-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Correct the error.' }}
				</p>
				@if (data.category) {
					<span class="mode-label">{{ data.category }}</span>
				}
				<blockquote>
					<span>Original</span>{{ data.original }}
				</blockquote>
				<mat-form-field
					appearance="outline"
					[attr.data-state]="correctionState()"
					><mat-label>Your correction</mat-label
					><textarea
						matInput
						rows="3"
						[value]="correction()"
						[disabled]="interactionState() !== 'idle'"
						(input)="setCorrection(inputFrom($event))"
					></textarea>
				</mat-form-field>
				<div
					class="answer-review"
					[class.answer-review--hidden]="
						interactionState() === 'idle'
					"
				>
					<strong>Correct answer</strong>
					<p>{{ data.answers[0] }}</p>
					@if (data.explanation) {
						<p>{{ data.explanation }}</p>
					}
				</div>
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorCorrectionSlideComponent
	extends ScoredSlideBase<ErrorCorrectionSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly correction = signal('');
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseErrorCorrection(context.data));
		this.correction.set('');
	}
	setCorrection(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.correction.set(value);
		this.setReady(Boolean(value.trim()));
	}
	private correct(): boolean {
		return answerMatches(this.correction(), {
			answers: this.data().answers,
		});
	}
	correctionState(): string {
		return this.interactionState() === 'idle'
			? 'neutral'
			: this.correct()
				? 'correct'
				: 'incorrect';
	}
	handleAction(actionId: string): void {
		if (actionId !== 'check' || !this.correction().trim()) return;
		const correct = this.correct();
		this.finish(
			correct,
			{
				original: this.data().original,
				correction: this.correction(),
				correctAnswer: this.data().answers[0],
				correct,
			},
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}

function parseRewrite(value: unknown): RewriteSlideData {
	const source = record(value);
	const acceptedAnswers = strings(source['acceptedAnswers']);
	const requiredFragments = strings(source['requiredFragments']);
	const modelAnswer = text(source['modelAnswer']) || undefined;
	if (!acceptedAnswers.length && !requiredFragments.length && !modelAnswer)
		throw new Error('Rewrite slide requires an accepted or model answer.');
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			[
				'paraphrase',
				'target-vocabulary',
				'sentence-transformation',
				'noun-to-verb',
				'verb-to-noun',
				'formalize',
				'linking-word',
				'synonym-replacement',
			] as const,
			'paraphrase',
		),
		original: requiredText(source['original'], 'Original text'),
		acceptedAnswers,
		requiredFragments,
		targetWords: strings(source['targetWords']),
		modelAnswer,
	};
}

@Component({
	selector: 'app-rewrite-slide',
	standalone: true,
	imports: [
		MatChipsModule,
		MatFormFieldModule,
		MatInputModule,
		SlideStimulusComponent,
	],
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="rewrite-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Rewrite the sentence.' }}
				</p>
				<blockquote>{{ data.original }}</blockquote>
				@if (data.targetWords?.length) {
					<mat-chip-set aria-label="Target words">
						@for (word of data.targetWords; track word) {
							<mat-chip>{{ word }}</mat-chip>
						}
					</mat-chip-set>
				}
				<mat-form-field
					appearance="outline"
					[attr.data-state]="responseState()"
					><mat-label>Your rewrite</mat-label
					><textarea
						matInput
						rows="3"
						[value]="response()"
						[disabled]="interactionState() !== 'idle'"
						(input)="setResponse(inputFrom($event))"
					></textarea>
				</mat-form-field>
				@if (data.modelAnswer) {
					<div
						class="answer-review"
						[class.answer-review--hidden]="
							interactionState() === 'idle'
						"
					>
						<strong>Model answer</strong>
						<p>{{ data.modelAnswer }}</p>
					</div>
				}
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RewriteSlideComponent
	extends ScoredSlideBase<RewriteSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly response = signal('');
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseRewrite(context.data));
		this.response.set('');
	}
	setResponse(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.response.set(value);
		this.setReady(Boolean(value.trim()));
	}
	private correct(): boolean {
		const data = this.data();
		const normalized = normalizeAnswer(this.response());
		return Boolean(
			data.acceptedAnswers?.some(
				(answer) => normalizeAnswer(answer) === normalized,
			) ||
			(data.requiredFragments?.length &&
				data.requiredFragments.every((fragment) =>
					normalized.includes(normalizeAnswer(fragment)),
				)),
		);
	}
	responseState(): string {
		return this.interactionState() === 'idle'
			? 'neutral'
			: this.correct()
				? 'correct'
				: 'incorrect';
	}
	handleAction(actionId: string): void {
		if (actionId !== 'check' || !this.response().trim()) return;
		const correct = this.correct();
		this.finish(
			correct,
			{
				response: this.response(),
				correct,
				modelAnswer: this.data().modelAnswer,
			},
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}

@Component({
	selector: 'app-pronunciation-slide',
	standalone: true,
	imports: [MatButtonModule, SlideStimulusComponent],
	template: CHOICE_TEMPLATE,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PronunciationSlideComponent extends ChoiceSlideComponent {
	override load(context: SlideContentContext): void {
		const source = record(context.data);
		const mode = stringMode(
			source['mode'],
			[
				'phoneme-match',
				'sound-choice',
				'word-stress',
				'listen-and-identify',
				'ipa-match',
				'repeat',
			] as const,
			'sound-choice',
		);
		const parsedOptions =
			mode === 'repeat'
				? [{ id: 'repeated', label: 'I repeated it aloud' }]
				: options(source['options']);
		super.load({
			...context,
			data: {
				...common(source),
				mode: 'single',
				question: requiredText(
					source['question'],
					'Pronunciation question',
				),
				options: parsedOptions,
				correctOptionIds: [
					mode === 'repeat'
						? 'repeated'
						: requiredText(
								source['correctOptionId'],
								'Pronunciation answer',
							),
				],
			},
		});
	}
}

function parseDictation(value: unknown): DictationSlideData {
	const source = record(value);
	const answer = requiredText(source['answer'], 'Dictation answer');
	const maxReplays = Number(source['maxReplays']);
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			['word', 'phrase', 'sentence'] as const,
			'word',
		),
		audio: requiredText(source['audio'], 'Dictation audio'),
		answer,
		acceptedAnswers: strings(source['acceptedAnswers']),
		maxReplays:
			Number.isInteger(maxReplays) && maxReplays > 0
				? maxReplays
				: undefined,
		punctuationSensitive: source['punctuationSensitive'] === true,
		caseSensitive: source['caseSensitive'] !== false,
	};
}

@Component({
	selector: 'app-dictation-slide',
	standalone: true,
	imports: [
		MatButtonModule,
		MatFormFieldModule,
		MatInputModule,
		SlideStimulusComponent,
	],
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="dictation-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Listen and type what you hear.' }}
				</p>
				<audio
					#audio
					[src]="data.audio"
					preload="metadata"
					aria-label="Dictation audio"
				></audio
				><button
					mat-stroked-button
					type="button"
					[disabled]="!canReplay()"
					aria-label="Play dictation audio"
					(click)="playAudio(audio)"
				>
					Play audio
				</button>
				@if (data.maxReplays) {
					<span class="replay-status"
						>{{ replayCount() }} of {{ data.maxReplays }} plays
						used</span
					>
				}
				<mat-form-field
					appearance="outline"
					[attr.data-state]="answerState()"
					><mat-label>Your answer</mat-label
					><input
						matInput
						[value]="answer()"
						[disabled]="interactionState() !== 'idle'"
						(input)="setAnswer(inputFrom($event))"
				/></mat-form-field>
				<div
					class="answer-review"
					[class.answer-review--hidden]="
						interactionState() !== 'answered-incorrect'
					"
				>
					<strong>Answer</strong>
					<p>{{ data.answer }}</p>
				</div>
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DictationSlideComponent
	extends ScoredSlideBase<DictationSlideData>
	implements SlideContentComponent, OnDestroy
{
	readonly answer = signal('');
	readonly replayCount = signal(0);
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		this.begin(context.slideId, parseDictation(context.data));
		this.answer.set('');
		this.replayCount.set(0);
	}
	canReplay(): boolean {
		const maxReplays = this.data().maxReplays;
		return !maxReplays || this.replayCount() < maxReplays;
	}
	playAudio(audio: HTMLAudioElement): void {
		if (!this.canReplay()) return;
		this.replayCount.update((count) => count + 1);
		audio.currentTime = 0;
		void audio.play();
	}
	setAnswer(value: string): void {
		if (this.interactionState() !== 'idle') return;
		this.answer.set(value);
		this.setReady(Boolean(value.trim()));
	}
	private correct(): boolean {
		const data = this.data();
		return answerMatches(this.answer(), {
			answers: [data.answer, ...(data.acceptedAnswers ?? [])],
			caseSensitive: data.caseSensitive,
			punctuationSensitive: data.punctuationSensitive,
		});
	}
	answerState(): string {
		return this.interactionState() === 'idle'
			? 'neutral'
			: this.correct()
				? 'correct'
				: 'incorrect';
	}
	handleAction(actionId: string): void {
		if (actionId !== 'check' || !this.answer().trim()) return;
		const correct = this.correct();
		this.finish(
			correct,
			{ answer: this.answer(), correct, replayCount: this.replayCount() },
			this.data().explanation ?? '',
		);
	}
	ngOnDestroy(): void {
		this.destroy();
	}
}

function parseSpeaking(value: unknown): SpeakingResponseSlideData {
	const source = record(value);
	const prepSeconds = Number(source['prepSeconds']);
	const speakingSeconds = Number(source['speakingSeconds']);
	return {
		...common(source),
		mode: stringMode(
			source['mode'],
			['part1', 'cue-card', 'part3', 'vocabulary-production'] as const,
			'part1',
		),
		prompt: requiredText(source['prompt'], 'Speaking prompt'),
		promptBullets: strings(source['promptBullets']),
		prepSeconds:
			Number.isInteger(prepSeconds) && prepSeconds > 0
				? prepSeconds
				: undefined,
		speakingSeconds:
			Number.isInteger(speakingSeconds) && speakingSeconds > 0
				? speakingSeconds
				: undefined,
		targetVocabulary: strings(source['targetVocabulary']),
		notesEnabled: source['notesEnabled'] === true,
	};
}

@Component({
	selector: 'app-speaking-response-slide',
	standalone: true,
	imports: [
		MatButtonModule,
		MatChipsModule,
		MatFormFieldModule,
		MatInputModule,
		SlideStimulusComponent,
	],
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="speaking-response-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Record your response.' }}
				</p>
				<h1>{{ data.prompt }}</h1>
				@if (data.promptBullets?.length) {
					<ul>
						@for (bullet of data.promptBullets; track bullet) {
							<li>{{ bullet }}</li>
						}
					</ul>
				}
				@if (data.targetVocabulary?.length) {
					<mat-chip-set aria-label="Target vocabulary">
						@for (word of data.targetVocabulary; track word) {
							<mat-chip>{{ word }}</mat-chip>
						}
					</mat-chip-set>
				}
				@if (prepRemaining() > 0) {
					<p class="timer" aria-live="polite">
						Preparation: {{ prepRemaining() }}s
					</p>
				}
				@if (
					speakingRemaining() > 0 && recordingState() === 'recording'
				) {
					<p class="timer" aria-live="polite">
						Speaking: {{ speakingRemaining() }}s
					</p>
				}
				@if (data.notesEnabled) {
					<mat-form-field appearance="outline"
						><mat-label>Notes</mat-label
						><textarea
							matInput
							rows="2"
							[value]="notes()"
							(input)="notes.set(inputFrom($event))"
						></textarea>
					</mat-form-field>
				}
				<div class="recording-controls">
					@if (recordingState() !== 'recording') {
						<button
							mat-stroked-button
							type="button"
							[disabled]="
								recordingState() === 'requesting' || !supported
							"
							aria-label="Start recording"
							(click)="startRecording()"
						>
							{{
								recordingState() === 'recorded'
									? 'Record again'
									: 'Record response'
							}}
						</button>
					} @else {
						<button
							mat-flat-button
							type="button"
							aria-label="Stop recording"
							(click)="stopRecording()"
						>
							Stop recording
						</button>
					}
					@if (recordingUrl()) {
						<audio
							controls
							[src]="recordingUrl()"
							aria-label="Recorded response playback"
						></audio>
					}
				</div>
				@if (recordingError()) {
					<p class="inline-error" role="alert">
						{{ recordingError() }}
					</p>
				}
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeakingResponseSlideComponent
	extends ScoredSlideBase<SpeakingResponseSlideData>
	implements SlideContentComponent, OnDestroy
{
	private readonly recorder = inject(LocalAudioRecorderService);
	private timer: ReturnType<typeof setInterval> | null = null;
	readonly supported = this.recorder.supported();
	readonly recordingState = signal<
		'idle' | 'requesting' | 'recording' | 'recorded'
	>('idle');
	readonly recordingUrl = signal('');
	readonly recordingError = signal('');
	readonly notes = signal('');
	readonly prepRemaining = signal(0);
	readonly speakingRemaining = signal(0);
	inputFrom(event: Event): string {
		return inputValue(event);
	}
	load(context: SlideContentContext): void {
		const data = parseSpeaking(context.data);
		this.clearTimer();
		this.recorder.cancel();
		this.begin(context.slideId, data, 'submit');
		this.recordingState.set('idle');
		this.recordingUrl.set('');
		this.recordingError.set('');
		this.notes.set('');
		this.prepRemaining.set(data.prepSeconds ?? 0);
		this.speakingRemaining.set(data.speakingSeconds ?? 0);
		if (data.prepSeconds) this.startCountdown(this.prepRemaining);
	}
	async startRecording(): Promise<void> {
		if (
			!this.supported ||
			this.recordingState() === 'requesting' ||
			this.recordingState() === 'recording'
		)
			return;
		this.clearTimer();
		this.recordingError.set('');
		this.recordingState.set('requesting');
		try {
			await this.recorder.start();
			this.recordingState.set('recording');
			const seconds = this.data().speakingSeconds ?? 0;
			this.speakingRemaining.set(seconds);
			if (seconds)
				this.startCountdown(this.speakingRemaining, () => {
					void this.stopRecording();
				});
		} catch (error) {
			this.recordingState.set('idle');
			this.recordingError.set(
				error instanceof Error
					? error.message
					: 'Recording could not start.',
			);
		}
	}
	async stopRecording(): Promise<void> {
		if (this.recordingState() !== 'recording') return;
		this.clearTimer();
		try {
			this.recordingUrl.set(await this.recorder.stop());
			this.recordingState.set('recorded');
			this.setReady(true, 'submit');
		} catch (error) {
			this.recordingState.set('idle');
			this.recordingError.set(
				error instanceof Error
					? error.message
					: 'Recording could not be saved.',
			);
		}
	}
	handleAction(actionId: string): void {
		if (actionId !== 'submit' || this.recordingState() !== 'recorded')
			return;
		this.submit({
			recordingUrl: this.recordingUrl(),
			notes: this.notes(),
			mode: this.data().mode,
		});
	}
	private startCountdown(
		target: { update(fn: (value: number) => number): void; (): number },
		done?: () => void,
	): void {
		this.clearTimer();
		this.timer = setInterval(() => {
			target.update((value) => Math.max(0, value - 1));
			if (target() === 0) {
				this.clearTimer();
				done?.();
			}
		}, 1000);
	}
	private clearTimer(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
	ngOnDestroy(): void {
		this.clearTimer();
		this.recorder.cancel();
		this.destroy();
	}
}

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
	template: `@if (content(); as data) {
		<article class="slide-type" data-testid="writing-response-slide">
			@if (data.stimulus) {
				<app-slide-stimulus [stimulus]="data.stimulus" />
			}
			<section class="slide-interaction">
				<p class="slide-instruction">
					{{ data.instruction || 'Write your response.' }}
				</p>
				<h1>{{ data.prompt }}</h1>
				@if (data.register && data.register !== 'neutral') {
					<span class="mode-label">{{ data.register }} register</span>
				}
				@if (data.targetVocabulary?.length) {
					<mat-chip-set aria-label="Target vocabulary">
						@for (word of data.targetVocabulary; track word) {
							<mat-chip>{{ word }}</mat-chip>
						}
					</mat-chip-set>
				}
				@if (data.planningNotes) {
					<mat-form-field appearance="outline"
						><mat-label>Planning notes</mat-label
						><textarea
							matInput
							rows="2"
							[value]="notes()"
							[disabled]="interactionState() !== 'idle'"
							(input)="notes.set(inputFrom($event))"
						></textarea>
					</mat-form-field>
				}
				<mat-form-field appearance="outline"
					><mat-label>Your response</mat-label
					><textarea
						matInput
						rows="8"
						[value]="response()"
						[disabled]="interactionState() !== 'idle'"
						(input)="setResponse(inputFrom($event))"
					></textarea
					><mat-hint
						>{{ wordCount() }} words
						@if (data.recommendedMinimumWords) {
							· recommended minimum
							{{ data.recommendedMinimumWords }}
						}
					</mat-hint></mat-form-field
				>
				@if (remainingSeconds() > 0) {
					<p class="timer" aria-live="polite">
						Time remaining: {{ remainingSeconds() }}s
					</p>
				}
				@if (data.modelAnswer) {
					<div
						class="answer-review"
						[class.answer-review--hidden]="
							interactionState() !== 'revealed'
						"
					>
						<strong>Model answer</strong>
						<p>{{ data.modelAnswer }}</p>
					</div>
				}
			</section>
		</article>
	}`,
	styleUrl: './slide-library.component.scss',
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
