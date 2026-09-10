import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Output,
	ViewChild,
	inject,
	signal,
} from "@angular/core";
import { CollectionLearningPathApiService } from "../../../../core/collection-learning-path/collection-learning-path-api.service";
import { parseSlideSequenceExercise } from "../../../../domain/collection-learning-path/slide-sequence-exercise";
import {
	createDefaultSlideContentRegistry,
	SlideExerciseComponent,
	type SlideExerciseActionEvent,
	type SlideExerciseContentEvent,
	type SlideExerciseResult,
	type SlideExerciseSlide,
} from "../../../../shared/slide-exercise";
import { LessonVocabularyScopeSlideComponent } from "./lesson-vocabulary-scope-slide.component";
import type {
	ExerciseComponent,
	ExerciseContext,
	ExerciseOutcome,
} from "../exercise-runtime/exercise-contracts";

function message(error: unknown): string {
	return error instanceof Error && error.message
		? error.message
		: "This slide sequence could not be prepared.";
}

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function learnerResponse(
	slideType: string,
	value: unknown,
): Record<string, unknown> | null {
	const data = record(value);
	if (!data) return null;
	if (
		slideType === "selection" ||
		slideType === "choice" ||
		slideType === "truth" ||
		slideType === "pronunciation"
	) {
		return { selectedOptionIds: data["selectedOptionIds"] };
	}
	if (slideType === "number-input") return { value: data["value"] };
	if (slideType === "classification")
		return { assignments: data["assignments"] };
	if (slideType === "matching")
		return { assignments: data["assignments"] };
	if (
		slideType === "cloze" ||
		slideType === "structured-completion" ||
		slideType === "word-formation"
	) {
		return { answers: data["answers"] };
	}
	if (slideType === "short-answer" || slideType === "dictation")
		return { answer: data["answer"] };
	if (slideType === "error-correction")
		return { correction: data["correction"] };
	if (slideType === "rewrite" || slideType === "writing-response")
		return { response: data["response"] };
	if (slideType === "ordering")
		return { orderedItemIds: data["orderedItemIds"] };
	return null;
}

@Component({
	selector: "app-slides-sequence-exercise",
	standalone: true,
	imports: [SlideExerciseComponent],
	templateUrl: "./slides-sequence-exercise.component.html",
	styleUrl: "./slides-sequence-exercise.component.scss",
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlidesSequenceExerciseComponent implements ExerciseComponent {
	private readonly api = inject(CollectionLearningPathApiService);
	@Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
	@ViewChild(SlideExerciseComponent)
	private slideExercise?: SlideExerciseComponent;

	readonly slides = signal<readonly SlideExerciseSlide[]>([]);
	readonly runtime = signal<ExerciseContext | null>(null);
	readonly registry = (() => {
		const registry = createDefaultSlideContentRegistry();
		registry.register({
			type: "lesson-vocabulary-scope",
			chromeDefaults: {
				header: { visible: false },
				footer: {
					primary: {
						id: "start-vocabulary-scope",
						behavior: "content",
						disabled: false,
					},
					secondary: false,
				},
			},
			loadComponent: async () => LessonVocabularyScopeSlideComponent,
		});
		return registry;
	})();
	readonly error = signal("");
	private readonly completed = signal(false);
	private readonly finishing = signal(false);
	private retryIncorrect = false;
	private readonly sourceSlides = new Map<string, SlideExerciseSlide>();
	private readonly retryCounts = new Map<string, number>();

	load(context: ExerciseContext): void {
		this.runtime.set(context);
		this.error.set("");
		this.completed.set(false);
		this.finishing.set(false);
		this.retryIncorrect = false;
		this.sourceSlides.clear();
		this.retryCounts.clear();
		try {
			const definition = parseSlideSequenceExercise(context.config);
			const slides = definition.slides as readonly SlideExerciseSlide[];
			this.retryIncorrect = definition.retryIncorrect;
			this.slides.set(slides);
			slides
				.filter((slide) => !slide.terminal)
				.forEach((slide) => {
					this.sourceSlides.set(slide.id, slide);
				});
		} catch (error) {
			this.slides.set([]);
			this.error.set(message(error));
		}
	}

	onAction(event: SlideExerciseActionEvent): void {
		if (event.actionId === "finish") void this.finish(event.slideId);
	}

	onContentEvent(event: SlideExerciseContentEvent): void {
		if (!this.retryIncorrect || event.type !== "answered") return;
		const result = event.data;
		if (
			!result ||
			typeof result !== "object" ||
			Array.isArray(result) ||
			(result as Record<string, unknown>)["correct"] !== false
		)
			return;
		const deck = this.slideExercise;
		const current = deck?.currentSlide;
		if (!current || current.id !== event.slideId) return;
		const rootId = current.rootSlideId?.trim() || current.id;
		const source =
			this.sourceSlides.get(rootId) ??
			deck.deck.find((slide) => slide.id === rootId);
		if (!source) return;
		const retryNumber = (this.retryCounts.get(rootId) ?? 0) + 1;
		this.retryCounts.set(rootId, retryNumber);
		deck.deckController.insertSlides({
			anchorId: current.id,
			gap: 2,
			slides: [
				{
					...source,
					id: `${rootId}-retry-${retryNumber}`,
					rootSlideId: rootId,
					retryNumber,
					terminal: false,
				},
			],
		});
	}

	async finish(
		slideId = this.slideExercise?.currentSlide?.id ?? "",
	): Promise<void> {
		if (this.completed() || this.finishing()) return;
		const terminal = this.slides().at(-1);
		if (
			!terminal?.terminal ||
			terminal.id !== slideId ||
			this.slideExercise?.currentSlide?.id !== slideId
		)
			return;
		this.finishing.set(true);
		this.error.set("");
		try {
			const slideResults = this.slideExercise.deckController.results();
			const results = (
				await Promise.all(
					slideResults.map((result) => this.evidenceResult(result)),
				)
			).filter((result) => result !== null);
			await this.runtime()?.sequenceCompletion?.(slideResults);
			this.completed.set(true);
			this.outcome.emit({
				kind: "completed",
				evidence: { schemaVersion: 1, results },
			});
		} catch (error) {
			this.error.set(
				message(error) ||
					"The speaking recording could not be saved. Try again.",
			);
		} finally {
			this.finishing.set(false);
		}
	}

	private async evidenceResult(result: SlideExerciseResult): Promise<{
		rootSlideId: string;
		slideType: string;
		itemId: string | undefined;
		eventType: "answered" | "submitted";
		data: Record<string, unknown>;
	} | null> {
		if (result.slideType === "speaking-response") {
			const recordingUrl = String(record(result.data)?.["recordingUrl"] ?? "").trim();
			if (!recordingUrl) throw new Error("A speaking recording is missing.");
			const response = await fetch(recordingUrl);
			if (!response.ok) throw new Error("The speaking recording could not be read.");
			const recording = await response.blob();
			const runtime = this.runtime();
			if (!runtime) throw new Error("The exercise context is unavailable.");
			const artifact = await this.api.commandUploadSlideSequenceRecording(
				runtime.pathId,
				runtime.lessonId,
				runtime.exerciseId,
				result.rootSlideId,
				recording,
			);
			return {
				rootSlideId: result.rootSlideId,
				slideType: result.slideType,
				itemId: result.itemId,
				eventType: result.eventType,
				data: { recordingArtifactId: artifact.artifactId },
			};
		}
		const data = learnerResponse(result.slideType, result.data);
		return data
			? {
					rootSlideId: result.rootSlideId,
					slideType: result.slideType,
					itemId: result.itemId,
					eventType: result.eventType,
					data,
				}
			: null;
	}

	cancel(): void {
		if (!this.completed()) this.outcome.emit({ kind: "cancelled" });
	}
}
