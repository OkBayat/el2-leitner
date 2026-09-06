import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { VocabularyIntakeFacade } from '../../../../application/collection-learning-path/vocabulary-intake.facade';
import {
  parseVocabularyIntakePayload,
  vocabularyIntakeStateLabel,
} from '../../../../domain/collection-learning-path/vocabulary-intake';
import type {
  VocabularyIntakeItem,
  VocabularyIntakePayload,
} from '../../../../domain/collection-learning-path/vocabulary-intake';
import type { ExerciseComponent, ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Vocabulary could not be activated.';
}

@Component({
  selector: 'app-vocabulary-intake-exercise',
  standalone: true,
  templateUrl: './vocabulary-intake-exercise.component.html',
  styleUrl: './vocabulary-intake-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyIntakeExerciseComponent implements ExerciseComponent {
  private readonly facade = inject(VocabularyIntakeFacade);
  private readonly runtime = signal<ExerciseContext | null>(null);

  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
  readonly payload = signal<VocabularyIntakePayload | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly buttonLabel = computed(() => {
    const count = this.payload()?.summary.newCount ?? 0;
    return count > 0 ? `Add ${count} new word${count === 1 ? '' : 's'}` : 'Continue';
  });

  load(context: ExerciseContext): void {
    this.runtime.set(context);
    this.error.set('');
    try {
      this.payload.set(parseVocabularyIntakePayload(context.payload));
    } catch {
      this.payload.set(null);
      this.error.set('Vocabulary intake data is unavailable.');
    }
  }

  stateLabel(item: VocabularyIntakeItem): string {
    return vocabularyIntakeStateLabel(item);
  }

  async finish(): Promise<void> {
    const context = this.runtime();
    if (!context || !this.payload() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.facade.activate(context.pathId, context.lessonId, context.exerciseId);
      this.outcome.emit({ kind: 'completed' });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
