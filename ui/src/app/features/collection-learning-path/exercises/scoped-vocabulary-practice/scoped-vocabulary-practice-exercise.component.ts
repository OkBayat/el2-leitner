import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { ReviewSessionService } from '../../../../application/review/review-session.service';
import { parseScopedVocabularyPracticePayload } from '../../../../domain/collection-learning-path/scoped-vocabulary-practice';
import type { ScopedVocabularyPracticePayload } from '../../../../domain/collection-learning-path/scoped-vocabulary-practice';
import type { ExerciseComponent, ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Quick review could not be started.';
}

@Component({
  selector: 'app-scoped-vocabulary-practice-exercise',
  standalone: true,
  templateUrl: './scoped-vocabulary-practice-exercise.component.html',
  styleUrl: './scoped-vocabulary-practice-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScopedVocabularyPracticeExerciseComponent implements ExerciseComponent {
  readonly session = inject(ReviewSessionService);
  private readonly runtime = signal<ExerciseContext | null>(null);

  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
  readonly payload = signal<ScopedVocabularyPracticePayload | null>(null);
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
      this.payload.set(parseScopedVocabularyPracticePayload(context.payload));
    } catch {
      this.payload.set(null);
      this.error.set('Quick review data is unavailable.');
    }
  }

  async start(): Promise<void> {
    const payload = this.payload();
    if (!payload || this.busy()) return;
    if (payload.items.length === 0) {
      this.outcome.emit({ kind: 'completed', evidence: { empty: true } });
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const ok = await this.session.startScopedBoxOne(payload.items.map((item) => item.id));
      if (!ok) {
        this.error.set('There are no scoped House 1 words available to practice.');
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
          this.error.set('Quick review completion evidence is unavailable.');
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
