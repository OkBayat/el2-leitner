import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionLearningPathApiService } from "../../../../core/collection-learning-path/collection-learning-path-api.service";
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
	const uploadRecording = vi.fn();

	beforeEach(() => {
		uploadRecording.mockReset();
		uploadRecording.mockResolvedValue({ artifactId: "recording-1" });
		TestBed.configureTestingModule({
			providers: [
				{
					provide: CollectionLearningPathApiService,
					useValue: {
						commandUploadSlideSequenceRecording: uploadRecording,
					},
				},
			],
		});
	});

	afterEach(() => vi.unstubAllGlobals());

	it("renders configured slides and completes only from the terminal slide", async () => {
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

		await fixture.componentInstance.finish();
		expect(outcomes).not.toHaveBeenCalled();

		const slideExercise = fixture.debugElement.query(
			By.directive(SlideExerciseComponent),
		).componentInstance as SlideExerciseComponent;
		slideExercise.next();
		expect(outcomes).not.toHaveBeenCalled();
		await fixture.componentInstance.finish("summary");
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

	it("emits bounded result evidence from the completed deck", async () => {
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
		await fixture.componentInstance.finish("summary");

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

	it("uploads a real speaking blob and emits only the server-issued artifact reference", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			ok: true,
			blob: async () => new Blob([new Uint8Array(512)], { type: "audio/webm" }),
		}));
		TestBed.configureTestingModule({
			imports: [SlidesSequenceExerciseComponent],
			providers: [
				{
					provide: ReviewAnswerSoundService,
					useValue: { play: vi.fn(), stop: vi.fn() },
				},
			],
		});
		const fixture = TestBed.createComponent(SlidesSequenceExerciseComponent);
		const outcomes = vi.fn();
		fixture.componentInstance.outcome.subscribe(outcomes);
		fixture.componentInstance.load({
			...context,
			config: {
				slides: [
					{ id: "speaking", type: "speaking-response", data: {} },
					{ id: "summary", type: "summary", terminal: true, data: {} },
				],
			},
		});
		fixture.detectChanges();
		const slideExercise = fixture.debugElement.query(
			By.directive(SlideExerciseComponent),
		).componentInstance as SlideExerciseComponent;
		slideExercise.onContentEvent({
			type: "submitted",
			data: { recordingUrl: "blob:local-recording" },
		});
		slideExercise.next();

		await fixture.componentInstance.finish("summary");

		expect(uploadRecording).toHaveBeenCalledWith(
			"path-1",
			"lesson-1",
			"exercise-1",
			"speaking",
			expect.any(Blob),
		);
		expect(outcomes).toHaveBeenCalledWith({
			kind: "completed",
			evidence: {
				schemaVersion: 1,
				results: [
					{
						rootSlideId: "speaking",
						slideType: "speaking-response",
						itemId: undefined,
						eventType: "submitted",
						data: { recordingArtifactId: "recording-1" },
					},
				],
			},
		});
	});

	it("awaits an application-owned sequence completion handler before emitting completion", async () => {
		TestBed.configureTestingModule({
			imports: [SlidesSequenceExerciseComponent],
			providers: [
				{
					provide: ReviewAnswerSoundService,
					useValue: { play: vi.fn(), stop: vi.fn() },
				},
			],
		});
		const fixture = TestBed.createComponent(SlidesSequenceExerciseComponent);
		const outcomes = vi.fn();
		const sequenceCompletion = vi.fn().mockResolvedValue(undefined);
		fixture.componentInstance.outcome.subscribe(outcomes);
		fixture.componentInstance.load({
			...context,
			sequenceCompletion,
			config: {
				slides: [
					{ id: "choice", type: "choice", data: {} },
					{ id: "summary", type: "summary", terminal: true, data: {} },
				],
			},
		});
		fixture.detectChanges();
		const slideExercise = fixture.debugElement.query(
			By.directive(SlideExerciseComponent),
		).componentInstance as SlideExerciseComponent;
		slideExercise.onContentEvent({
			type: "answered",
			data: { selectedOptionIds: ["correct"], correct: true },
		});
		slideExercise.next();

		await fixture.componentInstance.finish("summary");

		expect(sequenceCompletion).toHaveBeenCalledWith([
			expect.objectContaining({ slideId: "choice", eventType: "answered" }),
		]);
		expect(outcomes).toHaveBeenCalledOnce();

		sequenceCompletion.mockRejectedValueOnce(new Error("Could not save practice."));
		fixture.componentInstance.load({
			...context,
			sequenceCompletion,
		});
		fixture.detectChanges();
		const reloadedSlideExercise = fixture.debugElement.query(
			By.directive(SlideExerciseComponent),
		).componentInstance as SlideExerciseComponent;
		reloadedSlideExercise.goTo("summary");
		outcomes.mockClear();

		await fixture.componentInstance.finish("summary");

		expect(outcomes).not.toHaveBeenCalled();
		expect(fixture.componentInstance.error()).toBe("Could not save practice.");
	});

	it("sends each first recorded slide result immediately and does not resend it at completion", async () => {
		TestBed.configureTestingModule({
			imports: [SlidesSequenceExerciseComponent],
			providers: [{
				provide: ReviewAnswerSoundService,
				useValue: { play: vi.fn(), stop: vi.fn() },
			}],
		});
		const fixture = TestBed.createComponent(SlidesSequenceExerciseComponent);
		const slideResult = vi.fn().mockResolvedValue(undefined);
		fixture.componentInstance.load({
			...context,
			slideResult,
			config: {
				slides: [
					{ id: "choice", itemId: "word-1", type: "choice", data: {} },
					{ id: "summary", type: "summary", terminal: true, data: {} },
				],
			},
		});
		fixture.detectChanges();
		const slideExercise = fixture.debugElement.query(
			By.directive(SlideExerciseComponent),
		).componentInstance as SlideExerciseComponent;

		slideExercise.onContentEvent({
			type: "answered",
			data: { selectedOptionIds: ["correct"], correct: true },
		});
		await vi.waitFor(() => expect(slideResult).toHaveBeenCalledOnce());
		expect(slideResult).toHaveBeenCalledWith(expect.objectContaining({
			slideId: "choice",
			itemId: "word-1",
			eventType: "answered",
		}));

		slideExercise.next();
		await fixture.componentInstance.finish("summary");

		expect(slideResult).toHaveBeenCalledOnce();
	});
});
