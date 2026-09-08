import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { describe, expect, it, vi } from "vitest";
import { ReviewAnswerSoundService } from "../../../../core/sound/review-answer-sound.service";
import { SlideExerciseComponent } from "../../../../shared/slide-exercise";
import type { ExerciseContext } from "../exercise-runtime/exercise-contracts";
import { SlidesSequenceExerciseComponent } from "./slides-sequence-exercise.component";

const context: ExerciseContext = {
	pathId: "path-1",
	lessonId: "lesson-1",
	exerciseId: "exercise-1",
	type: "slides.sequence",
	schemaVersion: 1,
	completionPolicy: "slide-sequence",
	config: {
		slides: [
			{
				id: "intro",
				type: "teaching-card",
				data: { title: "Ready?", body: "Work through the slides." },
			},
			{
				id: "summary",
				type: "summary",
				terminal: true,
				data: { title: "Done" },
			},
		],
	},
	payload: null,
};

describe("SlidesSequenceExerciseComponent", () => {
	it("renders configured slides and completes only from the terminal slide", () => {
		TestBed.configureTestingModule({
			imports: [SlidesSequenceExerciseComponent],
		});
		const fixture = TestBed.createComponent(
			SlidesSequenceExerciseComponent,
		);
		const outcomes = vi.fn();
		fixture.componentInstance.outcome.subscribe(outcomes);

		fixture.componentInstance.load(context);
		fixture.detectChanges();
		expect(
			fixture.nativeElement.querySelector(
				'[data-testid="slides-sequence-exercise"]',
			),
		).not.toBeNull();
		expect(
			fixture.componentInstance.slides().map((slide) => slide.id),
		).toEqual(["intro", "summary"]);

		fixture.componentInstance.finish();
		expect(outcomes).not.toHaveBeenCalled();

		const slideExercise = fixture.debugElement.query(
			By.directive(SlideExerciseComponent),
		).componentInstance as SlideExerciseComponent;
		slideExercise.next();
		expect(outcomes).not.toHaveBeenCalled();
		slideExercise.next();
		fixture.componentInstance.finish("summary");
		expect(outcomes).toHaveBeenCalledOnce();
		expect(outcomes).toHaveBeenCalledWith({
			kind: "completed",
			evidence: { schemaVersion: 1, results: [] },
		});
	});

	it("fails closed when the deck is invalid", () => {
		TestBed.configureTestingModule({
			imports: [SlidesSequenceExerciseComponent],
		});
		const fixture = TestBed.createComponent(
			SlidesSequenceExerciseComponent,
		);
		fixture.componentInstance.load({ ...context, config: { slides: [] } });
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain(
			"Exercise unavailable",
		);
		expect(fixture.componentInstance.slides()).toEqual([]);
	});

	it("requeues an incorrectly answered scored slide before the terminal summary", () => {
		TestBed.configureTestingModule({
			imports: [SlidesSequenceExerciseComponent],
		});
		const fixture = TestBed.createComponent(
			SlidesSequenceExerciseComponent,
		);
		fixture.componentInstance.load({
			...context,
			config: { ...context.config, retryIncorrect: true },
		});
		fixture.detectChanges();
		const slideExercise = fixture.debugElement.query(
			By.directive(SlideExerciseComponent),
		).componentInstance as SlideExerciseComponent;

		fixture.componentInstance.onContentEvent({
			slideId: "intro",
			type: "answered",
			data: { correct: false },
		});

		expect(slideExercise.deck.map((slide) => slide.id)).toEqual([
			"intro",
			"intro-retry-1",
			"summary",
		]);
		expect(slideExercise.deck[1]).toEqual(
			expect.objectContaining({
				rootSlideId: "intro",
				retryNumber: 1,
				terminal: false,
			}),
		);

		slideExercise.next();
		fixture.componentInstance.onContentEvent({
			slideId: "intro-retry-1",
			type: "answered",
			data: { correct: false },
		});
		expect(slideExercise.deck.map((slide) => slide.id)).toEqual([
			"intro",
			"intro-retry-1",
			"intro-retry-2",
			"summary",
		]);
	});

	it("emits bounded result evidence from the completed deck", () => {
		TestBed.configureTestingModule({
			imports: [SlidesSequenceExerciseComponent],
			providers: [
				{
					provide: ReviewAnswerSoundService,
					useValue: { play: vi.fn(), stop: vi.fn() },
				},
			],
		});
		const fixture = TestBed.createComponent(
			SlidesSequenceExerciseComponent,
		);
		const outcomes = vi.fn();
		fixture.componentInstance.outcome.subscribe(outcomes);
		fixture.componentInstance.load({
			...context,
			config: {
				retryIncorrect: true,
				slides: [
					{ id: "choice", type: "choice", data: {} },
					{
						id: "summary",
						type: "summary",
						terminal: true,
						data: {},
					},
				],
			},
		});
		fixture.detectChanges();
		const slideExercise = fixture.debugElement.query(
			By.directive(SlideExerciseComponent),
		).componentInstance as SlideExerciseComponent;

		slideExercise.onContentEvent({
			type: "answered",
			data: {
				selectedOptionIds: ["correct"],
				correctOptionIds: ["correct"],
				correct: true,
			},
		});
		slideExercise.next();
		fixture.componentInstance.finish("summary");

		expect(outcomes).toHaveBeenCalledWith({
			kind: "completed",
			evidence: {
				schemaVersion: 1,
				results: [
					{
						rootSlideId: "choice",
						slideType: "choice",
						itemId: undefined,
						eventType: "answered",
						data: { selectedOptionIds: ["correct"] },
					},
				],
			},
		});
	});
});
