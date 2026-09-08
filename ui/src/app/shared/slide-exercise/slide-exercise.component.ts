import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	HostListener,
	Input,
	OnChanges,
	OnDestroy,
	Output,
	SimpleChanges,
	ViewChild,
	signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { ReviewAnswerSoundService } from "../../core/sound/review-answer-sound.service";
import type { SlideContentEvent } from "./slide-content-contracts";
import { SlideContentHostComponent } from "./slide-content-host.component";
import {
	createDefaultSlideContentRegistry,
	type SlideContentRegistry,
} from "./slide-content-registry";
import { SlideExerciseActionComponent } from "./slide-exercise-action.component";
import { SlideExerciseFooterComponent } from "./slide-exercise-footer.component";
import { SlideExerciseHeaderComponent } from "./slide-exercise-header.component";
import {
	resolveSlideExercisePresentation,
	validateSlideExerciseSlides,
	type SlideExerciseActionEvent,
	type SlideExerciseActionView,
	type SlideExerciseChromeConfig,
	type SlideExerciseContentEvent,
	type SlideExerciseDeckController,
	type SlideExerciseInsertCommand,
	type SlideExercisePresentation,
	type SlideExerciseResult,
	type SlideExerciseRuntimeState,
	type SlideExerciseSlide,
	type SlideExerciseSlideChange,
} from "./slide-exercise.models";

const GUIDE_LIGHTBULB_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>';

@Component({
	selector: "app-slide-exercise",
	standalone: true,
	imports: [
		MatButtonModule,
		MatIconModule,
		SlideContentHostComponent,
		SlideExerciseActionComponent,
		SlideExerciseFooterComponent,
		SlideExerciseHeaderComponent,
	],
	templateUrl: "./slide-exercise.component.html",
	styleUrl: "./slide-exercise.component.scss",
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideExerciseComponent implements OnChanges, OnDestroy {
	@Input({ required: true }) slides: readonly SlideExerciseSlide[] = [];
	@Input() defaults: SlideExerciseChromeConfig = {};
	@Input() registry: SlideContentRegistry =
		createDefaultSlideContentRegistry();
	@Input() environment?: unknown;
	@Output() readonly close = new EventEmitter<void>();
	@Output() readonly action = new EventEmitter<SlideExerciseActionEvent>();
	@Output() readonly contentEvent =
		new EventEmitter<SlideExerciseContentEvent>();
	@Output() readonly slideChange =
		new EventEmitter<SlideExerciseSlideChange>();
	@Output() readonly completed = new EventEmitter<void>();
	@ViewChild(SlideContentHostComponent)
	private contentHost?: SlideContentHostComponent;

	private readonly currentIndexState = signal(0);
	private readonly guideOpenState = signal(false);
	runtime: SlideExerciseRuntimeState = {};
	private readonly deckState = signal<readonly SlideExerciseSlide[]>([]);
	private readonly recordedResults: SlideExerciseResult[] = [];
	readonly deckController: SlideExerciseDeckController = {
		insertSlides: (command) => this.insertSlides(command),
		next: () => this.next(),
		results: () => this.results(),
	};

	constructor(
		private readonly answerSound: ReviewAnswerSoundService,
		iconRegistry: MatIconRegistry,
		sanitizer: DomSanitizer,
	) {
		iconRegistry.addSvgIconLiteral(
			"exercise-guide-lightbulb",
			sanitizer.bypassSecurityTrustHtml(GUIDE_LIGHTBULB_ICON),
		);
	}

	@HostListener("window:keydown", ["$event"])
	handleKeyboard(event: KeyboardEvent): void {
		if (this.guideSlide) {
			if (event.key === "Enter" || event.key === "Escape") {
				event.preventDefault();
				this.closeGuide();
			}
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const primary = this.presentation?.footer.primary;
			if (primary) this.handleAction(primary, "primary");
			return;
		}

		if (/^[1-9]$/.test(event.key)) {
			this.contentHost?.handleShortcut(event.key);
		}
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (!changes["slides"]) return;
		this.guideOpenState.set(false);
		const currentSlideId = changes["slides"].firstChange
			? ""
			: (this.currentSlide?.id ?? "");
		validateSlideExerciseSlides(this.slides);
		this.deckState.set([...this.slides]);
		if (changes["slides"].firstChange) this.recordedResults.length = 0;
		const preservedIndex = currentSlideId
			? this.deck.findIndex((slide) => slide.id === currentSlideId)
			: -1;
		if (preservedIndex >= 0) {
			this.currentIndex = preservedIndex;
			return;
		}
		this.currentIndex = 0;
		this.runtime = {};
	}

	get currentSlide(): SlideExerciseSlide | null {
		return this.deck[this.currentIndex] ?? null;
	}

	get guideAvailable(): boolean {
		return (
			this.currentIndex > 0 &&
			this.hasLeadingGuide &&
			!this.guideOpenState()
		);
	}

	get guideSlide(): SlideExerciseSlide | null {
		const firstSlide = this.deck[0];
		return this.guideOpenState() && this.hasLeadingGuide
			? firstSlide
			: null;
	}

	get deck(): readonly SlideExerciseSlide[] {
		return this.deckState();
	}

	get currentIndex(): number {
		return this.currentIndexState();
	}

	private set currentIndex(value: number) {
		this.currentIndexState.set(value);
	}

	get presentation(): SlideExercisePresentation | null {
		const slide = this.currentSlide;
		if (!slide) return null;
		const guideOffset = this.hasLeadingGuide ? 1 : 0;
		const presentation = resolveSlideExercisePresentation({
			slide,
			index: this.currentIndex - guideOffset,
			total: this.deck.length - guideOffset,
			rendererDefaults: this.registry.resolve(slide.type)?.chromeDefaults,
			exerciseDefaults: this.defaults,
			runtime: this.runtime,
		});
		if (!this.hasLeadingGuide || this.currentIndex > 0) {
			return presentation;
		}
		return {
			...presentation,
			header: { ...presentation.header, progress: null },
		};
	}

	private get hasLeadingGuide(): boolean {
		return this.deck[0]?.type === "teaching-card";
	}

	onContentState(state: SlideExerciseRuntimeState): void {
		this.runtime = state;
	}

	onContentEvent(event: SlideContentEvent): void {
		const slide = this.currentSlide;
		if (!slide) return;
		if (
			(event.type === "answered" || event.type === "submitted") &&
			!this.recordedResults.some((result) => result.slideId === slide.id)
		) {
			this.recordedResults.push({
				slideId: slide.id,
				rootSlideId: slide.rootSlideId?.trim() || slide.id,
				slideType: slide.type,
				eventType: event.type,
				itemId: slide.itemId,
				data: event.data,
			});
			if (
				event.type === "answered" &&
				event.data !== null &&
				typeof event.data === "object" &&
				!Array.isArray(event.data)
			) {
				const correct = (event.data as Record<string, unknown>)[
					"correct"
				];
				if (typeof correct === "boolean") {
					this.answerSound.play(correct ? "correct" : "incorrect");
				}
			}
		}
		this.contentEvent.emit({
			slideId: slide.id,
			type: event.type,
			data: event.data,
		});
	}

	ngOnDestroy(): void {
		this.answerSound.stop();
	}

	openGuide(): void {
		if (this.guideAvailable) this.guideOpenState.set(true);
	}

	closeGuide(): void {
		this.guideOpenState.set(false);
	}

	handleClose(): void {
		if (this.guideSlide) this.closeGuide();
		else this.close.emit();
	}

	handleAction(
		view: SlideExerciseActionView,
		slot: "primary" | "secondary",
	): void {
		const slide = this.currentSlide;
		if (!slide || view.disabled || view.loading) return;
		this.action.emit({
			slideId: slide.id,
			actionId: view.id,
			behavior: view.behavior,
			slot,
		});
		if (view.behavior === "next") this.next();
		else if (view.behavior === "content")
			this.contentHost?.handleAction(view.id);
	}

	next(): void {
		if (this.currentIndex + 1 >= this.deck.length) {
			this.completed.emit();
			return;
		}
		this.currentIndex += 1;
		this.runtime = {};
		const slide = this.currentSlide;
		if (slide)
			this.slideChange.emit({
				index: this.currentIndex,
				slideId: slide.id,
			});
	}

	goTo(slideId: string): void {
		const index = this.deck.findIndex((slide) => slide.id === slideId);
		if (index < 0 || index === this.currentIndex) return;
		this.currentIndex = index;
		this.runtime = {};
		this.slideChange.emit({ index, slideId: this.deck[index].id });
	}

	insertSlides(command: SlideExerciseInsertCommand): void {
		const anchorIndex = this.deck.findIndex(
			(slide) => slide.id === command.anchorId,
		);
		if (anchorIndex < 0)
			throw new Error(
				`Slide insertion anchor was not found: ${command.anchorId}`,
			);
		if (!Number.isSafeInteger(command.gap) || command.gap < 0)
			throw new Error(
				"Slide insertion gap must be a non-negative integer.",
			);
		if (!command.slides.length) {
			this.deckState.set([...this.deck]);
			return;
		}
		validateSlideExerciseSlides(command.slides);
		if (command.slides.some((slide) => slide.terminal === true)) {
			throw new Error("Generated slides cannot be terminal.");
		}
		const existingIds = new Set(this.deck.map((slide) => slide.id));
		if (command.slides.some((slide) => existingIds.has(slide.id)))
			throw new Error(
				"Inserted slide ids must be unique in the exercise deck.",
			);
		const terminalIndex = this.deck.findIndex(
			(slide, index) => index > anchorIndex && slide.terminal === true,
		);
		const requestedIndex = anchorIndex + 1 + command.gap;
		const insertionIndex =
			terminalIndex >= 0
				? Math.min(requestedIndex, terminalIndex)
				: Math.min(requestedIndex, this.deck.length);
		this.deckState.set([
			...this.deck.slice(0, insertionIndex),
			...command.slides,
			...this.deck.slice(insertionIndex),
		]);
	}

	results(): readonly SlideExerciseResult[] {
		return this.recordedResults.map((result) => ({ ...result }));
	}
}
