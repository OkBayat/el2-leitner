import { SimpleChange } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { describe, expect, it, vi } from "vitest";
import { ReviewAnswerSoundService } from "../../core/sound/review-answer-sound.service";
import { SlideContentRegistry } from "./slide-content-registry";
import { SlideExerciseComponent } from "./slide-exercise.component";
import type { SlideExerciseSlide } from "./slide-exercise.models";

function slide(id: string, type = "message"): SlideExerciseSlide {
	return { id, type, data: {} };
}

function createComponent(): {
	component: SlideExerciseComponent;
	answerSound: {
		play: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
	};
} {
	const answerSound = { play: vi.fn(), stop: vi.fn() };
	const iconRegistry = { addSvgIconLiteral: vi.fn() };
	const sanitizer = { bypassSecurityTrustHtml: vi.fn((value) => value) };
	return {
		component: new SlideExerciseComponent(
			answerSound as unknown as ReviewAnswerSoundService,
			iconRegistry as unknown as MatIconRegistry,
			sanitizer as unknown as DomSanitizer,
		),
		answerSound,
	};
}

describe("SlideExerciseComponent", () => {
	it("preserves the active slide and renderer state when another slide configuration changes", () => {
		const { component } = createComponent();
		const initial = [
			slide("intro"),
			slide("question", "choice"),
			slide("summary", "summary"),
		];
		component.slides = initial;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, initial, true),
		});
		component.goTo("question");
		component.runtime = { chrome: { footer: { tone: "success" } } };

		const updated = [
			initial[0],
			initial[1],
			{ ...initial[2], data: { score: 1 } },
		];
		component.slides = updated;
		component.ngOnChanges({
			slides: new SimpleChange(initial, updated, false),
		});

		expect(component.currentSlide?.id).toBe("question");
		expect(component.runtime).toEqual({
			chrome: { footer: { tone: "success" } },
		});
	});

	it("opens a first teaching slide as a guide without leaving or resetting the active slide", () => {
		const { component } = createComponent();
		const slides = [
			slide("guide", "teaching-card"),
			slide("question", "choice"),
		];
		component.slides = slides;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, slides, true),
		});
		component.goTo("question");
		component.runtime = {
			chrome: { footer: { primary: { disabled: false } } },
		};
		const changes: unknown[] = [];
		component.slideChange.subscribe((change) => changes.push(change));

		expect(component.guideAvailable).toBe(true);
		component.openGuide();

		expect(component.guideSlide?.id).toBe("guide");
		expect(component.currentSlide?.id).toBe("question");
		expect(component.runtime).toEqual({
			chrome: { footer: { primary: { disabled: false } } },
		});
		expect(changes).toEqual([]);

		component.closeGuide();

		expect(component.guideSlide).toBeNull();
		expect(component.currentSlide?.id).toBe("question");
	});

	it("does not offer a guide when the first slide is not a teaching card", () => {
		const { component } = createComponent();
		const slides = [slide("intro"), slide("question", "choice")];
		component.slides = slides;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, slides, true),
		});
		component.goTo("question");

		expect(component.guideAvailable).toBe(false);
		component.openGuide();

		expect(component.guideSlide).toBeNull();
		expect(component.currentSlide?.id).toBe("question");
	});

	it("counts a leading guide unless its JSON explicitly excludes progress", () => {
		const { component } = createComponent();
		const slides = [
			slide("guide", "teaching-card"),
			slide("question-1", "choice"),
			slide("question-2", "choice"),
		];
		component.slides = slides;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, slides, true),
		});

		expect(
			component.presentation?.header.progress?.value,
		).toBeCloseTo(100 / 3);
		expect(component.presentation?.header.progress?.label).toBe("1 of 3");

		component.goTo("question-1");
		expect(
			component.presentation?.header.progress?.value,
		).toBeCloseTo(200 / 3);
		expect(component.presentation?.header.progress?.label).toBe("2 of 3");

		component.goTo("question-2");
		expect(component.presentation?.header.progress).toEqual({
			value: 100,
			label: "3 of 3",
		});
	});

	it("excludes an explicitly untracked leading slide from exercise progress", () => {
		const { component } = createComponent();
		const slides: SlideExerciseSlide[] = [
			{
				id: "setup",
				type: "selection",
				data: {},
				chrome: { header: { progress: null } },
			},
			slide("question-1", "choice"),
			slide("question-2", "choice"),
		];
		component.slides = slides;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, slides, true),
		});

		expect(component.guideAvailable).toBe(false);
		expect(component.presentation?.header.progress).toBeNull();

		component.goTo("question-1");
		expect(component.presentation?.header.progress).toEqual({
			value: 50,
			label: "1 of 2",
		});
	});

	it("maps Enter to returning from the guide before the active slide action", () => {
		const { component } = createComponent();
		const slides = [
			slide("guide", "teaching-card"),
			slide("question", "choice"),
		];
		component.slides = slides;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, slides, true),
		});
		component.goTo("question");
		component.openGuide();
		const actions: unknown[] = [];
		component.action.subscribe((action) => actions.push(action));
		const preventDefault = vi.fn();

		component.handleKeyboard({
			key: "Enter",
			preventDefault,
		} as unknown as KeyboardEvent);

		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(component.guideSlide).toBeNull();
		expect(actions).toEqual([]);
	});

	it("renders the guide icon beside the primary action and a single return action while reading it", () => {
		TestBed.configureTestingModule({
			imports: [SlideExerciseComponent],
			providers: [
				{
					provide: ReviewAnswerSoundService,
					useValue: { play: vi.fn(), stop: vi.fn() },
				},
			],
		});
		const fixture = TestBed.createComponent(SlideExerciseComponent);
		const slides = [slide("guide", "teaching-card"), slide("question")];
		fixture.componentRef.setInput("slides", slides);
		fixture.detectChanges();
		fixture.componentInstance.goTo("question");
		fixture.detectChanges();

		const guideAction = fixture.nativeElement.querySelector(
			".slide-exercise__guide-action",
		);
		const primaryAction = fixture.nativeElement.querySelector(
			".slide-exercise-action--primary",
		);
		expect(guideAction?.getAttribute("aria-label")).toBe(
			"Open the exercise guide",
		);
		expect(guideAction?.querySelector(".mat-mdc-icon-button")).not.toBeNull();
		const guideIcon = guideAction?.querySelector("mat-icon");
		expect(guideIcon?.getAttribute("svgicon")).toBe(
			"exercise-guide-lightbulb",
		);
		expect(guideIcon?.classList).not.toContain(
			"slide-exercise__guide-icon",
		);
		expect(guideAction?.querySelector("svg")).not.toBeNull();
		expect(guideAction?.classList).toContain(
			"slide-exercise__guide-action--split-start",
		);
		expect(primaryAction?.classList).toContain(
			"slide-exercise-action--split-end",
		);
		expect(primaryAction?.querySelector("button")?.classList).toContain(
			"mat-mdc-unelevated-button",
		);

		(guideAction.querySelector('button') as HTMLButtonElement | null)?.click();
		fixture.detectChanges();

		expect(fixture.componentInstance.currentSlide?.id).toBe("question");
		expect(
			fixture.nativeElement.querySelector('[data-guide-open="true"]'),
		).not.toBeNull();
		expect(
			fixture.nativeElement.querySelector(
				".slide-exercise-action--guide-return",
			)?.textContent,
		).toContain("Back to exercise");
		expect(
			fixture.nativeElement.querySelector('[role="progressbar"]'),
		).toBeNull();
	});

	it("offers a skip action when the active slide renderer cannot load", async () => {
		TestBed.configureTestingModule({
			imports: [SlideExerciseComponent],
			providers: [
				{
					provide: ReviewAnswerSoundService,
					useValue: { play: vi.fn(), stop: vi.fn() },
				},
			],
		});
		const fixture = TestBed.createComponent(SlideExerciseComponent);
		const registry = new SlideContentRegistry();
		registry.register({
			type: "broken",
			loadComponent: async () => {
				throw new Error("renderer failed");
			},
		});
		fixture.componentRef.setInput("registry", registry);
		fixture.componentRef.setInput("slides", [
			slide("broken", "broken"),
			slide("next", "message"),
		]);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const skip = fixture.nativeElement.querySelector(
			'[data-testid="skip-unavailable-slide"]',
		) as HTMLButtonElement | null;
		expect(
			[
				...fixture.nativeElement.querySelectorAll(
					'.slide-content-host__status--error button',
				),
			].map((button: HTMLButtonElement) => button.textContent?.trim()),
		).toEqual(['Skip', 'Try again']);
		expect(skip?.textContent).toContain("Skip");
		expect(skip?.querySelector(".mat-mdc-button-base")).not.toBeNull();

		(skip?.querySelector('button') as HTMLButtonElement | null)?.click();
		fixture.detectChanges();

		expect(fixture.componentInstance.currentSlide?.id).toBe("next");
		expect(fixture.componentInstance.results()).toEqual([]);
	});

	it("maps Enter to the current primary action", () => {
		const { component } = createComponent();
		const slides: SlideExerciseSlide[] = [
			{
				id: "question",
				type: "message",
				data: {},
				chrome: {
					footer: {
						primary: {
							id: "check",
							label: "Check",
							behavior: "emit",
						},
					},
				},
			},
		];
		component.slides = slides;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, slides, true),
		});
		const actions: unknown[] = [];
		component.action.subscribe((action) => actions.push(action));
		const preventDefault = vi.fn();

		component.handleKeyboard({
			key: "Enter",
			preventDefault,
		} as unknown as KeyboardEvent);

		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(actions).toEqual([
			{
				slideId: "question",
				actionId: "check",
				behavior: "emit",
				slot: "primary",
			},
		]);
	});

	it("maps answer feedback to semantic action components and keeps ordinary actions primary", () => {
		TestBed.configureTestingModule({
			imports: [SlideExerciseComponent],
			providers: [
				{
					provide: ReviewAnswerSoundService,
					useValue: { play: vi.fn(), stop: vi.fn() },
				},
			],
		});
		const fixture = TestBed.createComponent(SlideExerciseComponent);
		fixture.componentRef.setInput("slides", [slide("question")]);
		fixture.detectChanges();

		const primaryControl = (): Element | null =>
			fixture.nativeElement.querySelector(
				".slide-exercise-action--primary :is(voco-primary-button, voco-success-button, voco-error-button)",
			);

		expect(primaryControl()?.localName).toBe("voco-primary-button");
		expect(primaryControl()?.getAttribute("data-state")).toBe("primary");

		fixture.componentInstance.onContentState({
			chrome: { footer: { tone: "success" } },
		});
		expect(fixture.componentInstance.presentation?.footer.primary?.tone).toBe(
			"success",
		);
		fixture.detectChanges();
		expect(primaryControl()?.localName).toBe("voco-success-button");
		expect(primaryControl()?.getAttribute("data-state")).toBe("success");

		fixture.componentInstance.onContentState({
			chrome: { footer: { tone: "error" } },
		});
		fixture.detectChanges();
		expect(primaryControl()?.localName).toBe("voco-error-button");
		expect(primaryControl()?.getAttribute("data-state")).toBe("error");

		fixture.componentInstance.onContentState({
			chrome: { footer: { tone: "information" } },
		});
		fixture.detectChanges();
		expect(primaryControl()?.localName).toBe("voco-primary-button");
		expect(primaryControl()?.getAttribute("data-state")).toBe("primary");
	});

	it("lets a slide insert generated slides while keeping terminal slides last", () => {
		const { component } = createComponent();
		const initial: SlideExerciseSlide[] = [
			slide("scope", "leitner-house-one-scope"),
			{ ...slide("summary", "summary"), terminal: true },
		];
		component.slides = initial;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, initial, true),
		});

		component.insertSlides({
			anchorId: "scope",
			gap: 0,
			slides: [
				slide("word-1", "dictation"),
				slide("word-2", "dictation"),
			],
		});

		expect(component.deck.map((item) => item.id)).toEqual([
			"scope",
			"word-1",
			"word-2",
			"summary",
		]);
		expect(component.currentSlide?.id).toBe("scope");
	});

	it("schedules a retry after a gap and clamps it before the terminal slide", () => {
		const { component } = createComponent();
		const initial: SlideExerciseSlide[] = [
			slide("word-1", "dictation"),
			{ ...slide("summary", "summary"), terminal: true },
		];
		component.slides = initial;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, initial, true),
		});

		component.insertSlides({
			anchorId: "word-1",
			gap: 3,
			slides: [
				{
					...slide("word-1-retry", "dictation"),
					rootSlideId: "word-1",
					retryNumber: 1,
				},
			],
		});

		expect(component.deck.map((item) => item.id)).toEqual([
			"word-1",
			"word-1-retry",
			"summary",
		]);
	});

	it("lets a slide copy itself after three intervening slides through the public deck API", () => {
		const { component } = createComponent();
		const initial: SlideExerciseSlide[] = [
			slide("word-1", "dictation"),
			slide("word-2", "dictation"),
			slide("word-3", "dictation"),
			slide("word-4", "dictation"),
			slide("word-5", "dictation"),
			{ ...slide("summary", "summary"), terminal: true },
		];
		component.slides = initial;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, initial, true),
		});

		component.deckController.insertSlides({
			anchorId: "word-1",
			gap: 3,
			slides: [
				{
					...initial[0],
					id: "word-1-retry",
					rootSlideId: "word-1",
					retryNumber: 1,
				},
			],
		});

		expect(component.deck.map((item) => item.id)).toEqual([
			"word-1",
			"word-2",
			"word-3",
			"word-4",
			"word-1-retry",
			"word-5",
			"summary",
		]);
	});

	it("plays answer feedback once for each scored slide event", () => {
		const { component, answerSound } = createComponent();
		const slides = [
			slide("choice", "choice"),
			slide("writing", "writing-response"),
			slide("dictation", "dictation"),
		];
		component.slides = slides;
		component.ngOnChanges({
			slides: new SimpleChange(undefined, slides, true),
		});

		component.onContentEvent({ type: "answered", data: { correct: true } });
		component.onContentEvent({ type: "answered", data: { correct: true } });
		component.next();
		component.onContentEvent({
			type: "submitted",
			data: { correct: false },
		});
		component.next();
		component.onContentEvent({
			type: "answered",
			data: { correct: false },
		});

		expect(answerSound.play.mock.calls).toEqual([
			["correct"],
			["incorrect"],
		]);
	});

	it("stops answer feedback audio when the exercise is destroyed", () => {
		const { component, answerSound } = createComponent();

		component.ngOnDestroy();

		expect(answerSound.stop).toHaveBeenCalledOnce();
	});
});
