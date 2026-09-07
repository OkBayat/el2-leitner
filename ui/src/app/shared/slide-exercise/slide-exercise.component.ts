import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import type { SlideContentEvent } from './slide-content-contracts';
import { SlideContentHostComponent } from './slide-content-host.component';
import { createDefaultSlideContentRegistry, type SlideContentRegistry } from './slide-content-registry';
import { SlideExerciseActionComponent } from './slide-exercise-action.component';
import { SlideExerciseFooterComponent } from './slide-exercise-footer.component';
import { SlideExerciseHeaderComponent } from './slide-exercise-header.component';
import { resolveSlideExercisePresentation, validateSlideExerciseSlides, type SlideExerciseActionEvent, type SlideExerciseActionView, type SlideExerciseChromeConfig, type SlideExerciseContentEvent, type SlideExercisePresentation, type SlideExerciseRuntimeState, type SlideExerciseSlide, type SlideExerciseSlideChange } from './slide-exercise.models';

@Component({
  selector: 'app-slide-exercise',
  standalone: true,
  imports: [SlideContentHostComponent, SlideExerciseActionComponent, SlideExerciseFooterComponent, SlideExerciseHeaderComponent],
  templateUrl: './slide-exercise.component.html',
  styleUrl: './slide-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideExerciseComponent implements OnChanges {
  @Input({ required: true }) slides: readonly SlideExerciseSlide[] = [];
  @Input() defaults: SlideExerciseChromeConfig = {};
  @Input() registry: SlideContentRegistry = createDefaultSlideContentRegistry();
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly action = new EventEmitter<SlideExerciseActionEvent>();
  @Output() readonly contentEvent = new EventEmitter<SlideExerciseContentEvent>();
  @Output() readonly slideChange = new EventEmitter<SlideExerciseSlideChange>();
  @Output() readonly completed = new EventEmitter<void>();
  @ViewChild(SlideContentHostComponent) private contentHost?: SlideContentHostComponent;

  currentIndex = 0;
  runtime: SlideExerciseRuntimeState = {};

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const primary = this.presentation?.footer.primary;
      if (primary) this.handleAction(primary, 'primary');
      return;
    }

    if (/^[1-9]$/.test(event.key)) {
      this.contentHost?.handleShortcut(event.key);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['slides']) return;
    const currentSlideId = changes['slides'].firstChange ? '' : this.currentSlide?.id ?? '';
    validateSlideExerciseSlides(this.slides);
    const preservedIndex = currentSlideId ? this.slides.findIndex((slide) => slide.id === currentSlideId) : -1;
    if (preservedIndex >= 0) { this.currentIndex = preservedIndex; return; }
    this.currentIndex = 0;
    this.runtime = {};
  }

  get currentSlide(): SlideExerciseSlide | null { return this.slides[this.currentIndex] ?? null; }

  get presentation(): SlideExercisePresentation | null {
    const slide = this.currentSlide;
    if (!slide) return null;
    return resolveSlideExercisePresentation({ slide, index: this.currentIndex, total: this.slides.length, rendererDefaults: this.registry.resolve(slide.type)?.chromeDefaults, exerciseDefaults: this.defaults, runtime: this.runtime });
  }

  onContentState(state: SlideExerciseRuntimeState): void { this.runtime = state; }

  onContentEvent(event: SlideContentEvent): void {
    const slide = this.currentSlide;
    if (!slide) return;
    this.contentEvent.emit({ slideId: slide.id, type: event.type, data: event.data });
  }

  handleAction(view: SlideExerciseActionView, slot: 'primary' | 'secondary'): void {
    const slide = this.currentSlide;
    if (!slide || view.disabled || view.loading) return;
    this.action.emit({ slideId: slide.id, actionId: view.id, behavior: view.behavior, slot });
    if (view.behavior === 'next') this.next();
    else if (view.behavior === 'content') this.contentHost?.handleAction(view.id);
  }

  next(): void {
    if (this.currentIndex + 1 >= this.slides.length) { this.completed.emit(); return; }
    this.currentIndex += 1;
    this.runtime = {};
    const slide = this.currentSlide;
    if (slide) this.slideChange.emit({ index: this.currentIndex, slideId: slide.id });
  }

  goTo(slideId: string): void {
    const index = this.slides.findIndex((slide) => slide.id === slideId);
    if (index < 0 || index === this.currentIndex) return;
    this.currentIndex = index;
    this.runtime = {};
    this.slideChange.emit({ index, slideId: this.slides[index].id });
  }
}
