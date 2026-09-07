import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { Subject } from 'rxjs';
import type { VocabularySpellingScope } from '../../../../domain/collection-learning-path/vocabulary-spelling-practice';
import type { SlideContentComponent, SlideContentContext, SlideExerciseRuntimeState } from '../../../../shared/slide-exercise';
import type { ExerciseContext } from '../exercise-runtime/exercise-contracts';
import { SlideBaseExerciseSessionService } from '../slide-base/slide-base-exercise-session.service';
import { buildLeitnerVocabularySlides, type GeneratedVocabularySlide } from './leitner-house-one-scope-slide';

interface ScopeSlideData {
  readonly generatedSlide: GeneratedVocabularySlide;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseData(value: unknown): ScopeSlideData {
  const source = record(value);
  const generatedSlide = record(source?.['generatedSlide']);
  const type = String(generatedSlide?.['type'] ?? '').trim();
  if (!source || Object.keys(source).some((key) => key !== 'generatedSlide') || !type) {
    throw new Error('Leitner House 1 generated slide is unavailable.');
  }
  return { generatedSlide: { type } };
}

function exerciseContext(value: unknown): ExerciseContext {
  const context = record(value) as unknown as ExerciseContext | null;
  if (!context?.pathId || !context.lessonId || !context.exerciseId) {
    throw new Error('Learning path exercise context is unavailable.');
  }
  return context;
}

@Component({
  selector: 'app-leitner-house-one-scope-slide',
  standalone: true,
  imports: [MatRadioModule],
  templateUrl: './leitner-house-one-scope-slide.component.html',
  styleUrl: './leitner-house-one-scope-slide.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeitnerHouseOneScopeSlideComponent implements SlideContentComponent, OnDestroy {
  private readonly session: SlideBaseExerciseSessionService;
  private slideContext: SlideContentContext | null = null;
  private context: ExerciseContext | null = null;
  private readonly stateChanges = new Subject<SlideExerciseRuntimeState>();
  readonly stateChange = this.stateChanges.asObservable();
  readonly selected = signal<VocabularySpellingScope | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');

  constructor(session: SlideBaseExerciseSessionService) {
    this.session = session;
  }

  load(context: SlideContentContext): void {
    parseData(context.data);
    this.context = exerciseContext(context.environment);
    if (!context.deck) throw new Error('Slide deck controller is unavailable.');
    this.slideContext = context;
    this.selected.set(null);
    this.busy.set(false);
    this.error.set('');
    this.publishActionState();
  }

  select(scope: VocabularySpellingScope): void {
    if (scope !== 'course' && scope !== 'all' || this.busy()) return;
    this.selected.set(scope);
    this.publishActionState();
  }

  handleShortcut(key: string): void {
    if (key === '1') this.select('course');
    if (key === '2') this.select('all');
  }

  handleAction(actionId: string): void {
    if (actionId === 'start-spelling') void this.start();
  }

  ngOnDestroy(): void {
    this.stateChanges.complete();
  }

  private async start(): Promise<void> {
    const slide = this.slideContext;
    const runtime = this.context;
    const scope = this.selected();
    if (!slide?.deck || !runtime || !scope || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.publishActionState();
    try {
      const data = parseData(slide.data);
      const items = await this.session.startVocabularySpelling(runtime, scope);
      slide.deck.insertSlides({
        anchorId: slide.slideId,
        gap: 0,
        slides: buildLeitnerVocabularySlides(slide.slideId, data.generatedSlide, items),
      });
      slide.deck.next();
    } catch (error) {
      this.error.set(error instanceof Error && error.message ? error.message : 'Spelling practice could not start.');
      this.busy.set(false);
      this.publishActionState();
    }
  }

  private publishActionState(): void {
    this.stateChanges.next({
      chrome: {
        footer: {
          tone: this.error() ? 'error' : 'neutral',
          title: this.error() ? 'Could not continue' : '',
          detail: this.error(),
          primary: {
            id: 'start-spelling',
            label: "Let's go",
            behavior: 'content',
            disabled: !this.selected() || this.busy(),
            loading: this.busy(),
          },
          secondary: false,
        },
      },
    });
  }
}
