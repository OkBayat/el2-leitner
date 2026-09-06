import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { ReviewSessionService } from '../../../../application/review/review-session.service';
import { CollectionLearningPathApiService } from '../../../../core/collection-learning-path/collection-learning-path-api.service';
import {
  parseVocabularyMasteryCheckPayload,
  parseVocabularyMasteryCheckStart,
} from '../../../../domain/collection-learning-path/vocabulary-mastery-check';
import type { VocabularyMasteryCheckPayload } from '../../../../domain/collection-learning-path/vocabulary-mastery-check';
import type { ExerciseComponent, ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Mastery check could not be started.';
}

@Component({
  selector: 'app-vocabulary-mastery-check-exercise',
  standalone: true,
  templateUrl: './vocabulary-mastery-check-exercise.component.html',
  styleUrl: './vocabulary-mastery-check-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyMasteryCheckExerciseComponent implements ExerciseComponent {
  readonly session = inject(ReviewSessionService);
  private readonly api = inject(CollectionLearningPathApiService);
  private readonly runtime = signal<ExerciseContext | null>(null);

  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
  readonly payload = signal<VocabularyMasteryCheckPayload | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly started = signal(false);
  readonly answered = computed(() => this.session.feedback() !== null);
  readonly positionLabel = computed(() => {
    const total = this.session.initialCount();
    const answered = this.session.answered();
    return total > 0 ? `${Math.min(answered + (this.answered() ? 0 : 1), total)} / ${total}` : '';
  });

  load(context: ExerciseContext): void {
    this.runtime.set(context);
    this.error.set('');
    this.started.set(false);
    try {
      this.payload.set(parseVocabularyMasteryCheckPayload(context.payload));
    } catch {
      this.payload.set(null);
      this.error.set('Mastery check data is unavailable.');
    }
  }

  async start(): Promise<void> {
    const payload = this.payload();
    const runtime = this.runtime();
    if (!payload || !runtime || this.busy()) return;
    if (payload.items.length === 0) {
      this.outcome.emit({ kind: 'completed', evidence: { empty: true } });
      return;
    }

    this.busy.set(true);
    this.error.set('');
    try {
      const response = parseVocabularyMasteryCheckStart(await this.api.commandStartVocabularyMasteryCheck(
        runtime.pathId,
        runtime.lessonId,
        runtime.exerciseId,
      ));
      this.payload.set(response.payload);
      if (response.payload.items.length === 0) {
        this.outcome.emit({ kind: 'completed', evidence: { empty: true } });
        return;
      }
      if (!response.session) {
        this.error.set('Mastery check session evidence is unavailable.');
        return;
      }
      const ok = await this.session.startScopedMasteryCheck(
        response.payload.items.map((item) => item.id),
        response.session.id,
      );
      if (!ok) {
        this.error.set('The server mastery queue could not be matched to your current vocabulary state. Reload and try again.');
        return;
      }
      this.started.set(true);
      this.session.pronounce();
    } catch (error) {
      this.error.set(message(error));
    } finally {
      this.busy.set(false);
    }
  }

  async mark(correct: boolean): Promise<void> {
    const word = this.session.currentWord();
    if (!word || this.busy() || this.answered()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.session.submit(correct ? word.term : '', !correct);
    } catch (error) {
      this.error.set(message(error));
    } finally {
      this.busy.set(false);
    }
  }

  replay(): void {
    this.session.pronounce();
  }

  async next(): Promise<void> {
    if (this.busy() || !this.session.canAdvance()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.session.next();
      if (this.session.completed()) {
        const sessionId = this.session.completedSessionId();
        if (!sessionId) {
          this.error.set('Mastery check completion evidence is unavailable.');
          return;
        }
        this.outcome.emit({ kind: 'completed', evidence: { sessionId } });
        return;
      }
      this.session.pronounce();
    } catch (error) {
      this.error.set(message(error));
    } finally {
      this.busy.set(false);
    }
  }
}
