import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router } from '@angular/router';
import { LeitnerDictationSlideBuilderService } from '../../application/review/leitner-dictation-slide-builder.service';
import { LeitnerSlideSessionService } from '../../application/review/leitner-slide-session.service';
import { LeitnerWordDefinitionsService } from '../../application/review/leitner-word-definitions.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { getDueWords } from '../../domain/learning/learning-rules';
import type { LearningWord } from '../../domain/learning/models';
import type { NumberInputSlideExpansionHandler, SlideExerciseSlide } from '../../shared/slide-exercise';
import type { ExerciseContext, ExerciseOutcome } from '../collection-learning-path/exercises/exercise-runtime/exercise-contracts';
import { SlidesSequenceExerciseComponent } from '../collection-learning-path/exercises/slides-sequence/slides-sequence-exercise.component';

type LeitnerSlidePracticeMode = 'add-new' | 'daily-review';

function summarySlide(mode: LeitnerSlidePracticeMode): SlideExerciseSlide {
	return {
		id: 'finish',
		type: 'summary',
		terminal: true,
		data: mode === 'add-new'
			? {
				aggregationMode: 'first-attempts',
				eyebrow: 'New-word practice complete',
				title: 'Your new words are in the Leitner system',
				subtitle: 'Correct spellings moved to House 2. Mistakes remain in House 1.',
			}
			: {
				aggregationMode: 'first-attempts',
				eyebrow: 'Daily review complete',
				title: "Today's scheduled words have been reviewed",
				subtitle: 'Correct answers advanced when due. Mistakes returned to House 1.',
			},
		chrome: {
			footer: {
				primary: { id: 'finish', label: 'Finish', behavior: 'emit' },
				secondary: false,
			},
		},
	};
}

function wordIds(slides: readonly SlideExerciseSlide[], expectedCount: number): readonly string[] {
	const ids = slides.map((slide) => slide.itemId?.trim()).filter((id): id is string => Boolean(id));
	if (slides.length !== expectedCount || ids.length !== expectedCount || new Set(ids).size !== expectedCount) {
		throw new Error('The spelling slide deck does not cover every requested word.');
	}
	return ids;
}

@Component({
	selector: 'app-leitner-slide-practice-page',
	standalone: true,
	imports: [MatButtonModule, SlidesSequenceExerciseComponent],
	templateUrl: './leitner-slide-practice-page.component.html',
	styleUrl: './leitner-slide-practice-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeitnerSlidePracticePageComponent implements OnInit, OnDestroy {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly store = inject(LearningStoreService);
	private readonly slideBuilder = inject(LeitnerDictationSlideBuilderService);
	private readonly session = inject(LeitnerSlideSessionService);
	private readonly definitions = inject(LeitnerWordDefinitionsService);
	private readonly mode = this.route.snapshot.data['practiceMode'] as LeitnerSlidePracticeMode;
	private exercise?: SlidesSequenceExerciseComponent;
	private finished = false;
	readonly loading = signal(true);
	readonly error = signal('');
	readonly exerciseContext = signal<ExerciseContext | null>(null);

	@ViewChild(SlidesSequenceExerciseComponent)
	set exerciseComponent(value: SlidesSequenceExerciseComponent | undefined) {
		this.exercise = value;
		const context = this.exerciseContext();
		if (value && context) value.load(context);
	}

	ngOnInit(): void {
		void this.load();
	}

	ngOnDestroy(): void {
		if (!this.finished) void this.session.abandon();
	}

	async load(): Promise<void> {
		this.loading.set(true);
		this.error.set('');
		this.exerciseContext.set(null);
		try {
			if (this.mode !== 'add-new' && this.mode !== 'daily-review') {
				throw new Error('This spelling practice mode is unavailable.');
			}
			const state = await this.store.initialize();
			const context = this.mode === 'add-new'
				? this.addNewWordsContext(state.words, state.settings.dailyNew)
				: await this.dailyReviewContext();
			this.exerciseContext.set(context);
			this.loading.set(false);
			this.exercise?.load(context);
		} catch (error) {
			await this.session.abandon();
			this.error.set(error instanceof Error ? error.message : 'This spelling practice could not be prepared.');
			this.loading.set(false);
		}
	}

	async onOutcome(outcome: ExerciseOutcome): Promise<void> {
		if (outcome.kind === 'cancelled') await this.session.abandon();
		this.finished = true;
		await this.router.navigateByUrl('/dashboard');
	}

	private addNewWordsContext(words: readonly LearningWord[], dailyNew: number): ExerciseContext {
		const available = words.filter((word) => word.box === 0 && !word.introducedOn).sort((left, right) => left.number - right.number);
		if (!available.length) throw new Error('All available words are already in your Leitner boxes.');
		const max = available.length;
		const initialValue = Math.min(max, Math.max(1, Number.isSafeInteger(dailyNew) ? dailyNew : 10));
		const expand: NumberInputSlideExpansionHandler = async (request) => {
			if (request.expansionId !== 'new-word-practice') {
				throw new Error(`Unsupported number input expansion: ${request.expansionId}`);
			}
			if (!Number.isSafeInteger(request.value) || request.value < 1 || request.value > max) {
				throw new Error(`Choose a whole number between 1 and ${max}.`);
			}
			const currentAvailable = this.store.snapshot().words
				.filter((word) => word.box === 0 && !word.introducedOn)
				.sort((left, right) => left.number - right.number);
			if (currentAvailable.length < request.value) {
				throw new Error('The available new-word list changed. Choose a smaller number and try again.');
			}
			const activated = await this.store.activateWords(currentAvailable.slice(0, request.value), 'home-selection');
			if (activated.activated.length !== request.value) {
				throw new Error('Not every requested word could be added to House 1.');
			}
			const definitions = await this.definitions.load(activated.activated);
			const slides = this.slideBuilder.build(request.slideId, activated.activated, definitions);
			await this.session.start('new', wordIds(slides, request.value));
			return { slides };
		};

		return this.context('add-new-words', {
			numberInputExpansion: expand,
			slides: [
				{
					id: 'word-count',
					type: 'number-input',
					data: {
						instruction: 'Choose the size of this spelling practice.',
						question: 'How many new words would you like to add?',
						label: 'Number of words',
						min: 1,
						max,
						step: 1,
						initialValue,
						expansionId: 'new-word-practice',
					},
					chrome: { header: { progress: null } },
				},
				summarySlide('add-new'),
			],
		});
	}

	private async dailyReviewContext(): Promise<ExerciseContext> {
		const due = getDueWords(this.store.snapshot());
		if (!due.length) throw new Error("Today's scheduled review is already complete.");
		const definitions = await this.definitions.load(due);
		const slides = this.slideBuilder.build('daily-review', due, definitions);
		await this.session.start('review', wordIds(slides, due.length));
		return this.context('daily-review', { slides: [...slides, summarySlide('daily-review')] });
	}

	private context(
		exerciseId: string,
		values: { readonly slides: readonly SlideExerciseSlide[]; readonly numberInputExpansion?: NumberInputSlideExpansionHandler },
	): ExerciseContext {
		return {
			pathId: 'standalone-practice',
			lessonId: 'leitner-spelling',
			exerciseId,
			type: 'slides.sequence',
			schemaVersion: 1,
			completionPolicy: 'slide-sequence',
			payload: null,
			numberInputExpansion: values.numberInputExpansion,
			slideResult: (result) => result.slideType === 'dictation' ? this.session.record(result) : Promise.resolve(),
			sequenceCompletion: () => this.session.complete(),
			config: { slides: values.slides },
		};
	}
}
