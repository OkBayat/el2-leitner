import { ChangeDetectionStrategy, Component, EventEmitter, Output, signal } from '@angular/core';
import {
  parseIeltsListeningExercisePayload,
  type IeltsListeningExercisePayload,
} from '../../../../domain/collection-learning-path/ielts-listening-exercise';
import { BbcListeningPracticePageComponent } from '../../../bbc-listening/bbc-listening-practice-page.component';
import type { ExerciseComponent, ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';

@Component({
  selector: 'app-ielts-listening-exercise',
  standalone: true,
  imports: [BbcListeningPracticePageComponent],
  templateUrl: './ielts-listening-exercise.component.html',
  styleUrl: './ielts-listening-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IeltsListeningExerciseComponent implements ExerciseComponent {
  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
  readonly payload = signal<IeltsListeningExercisePayload | null>(null);
  readonly completed = signal(false);
  readonly error = signal('');

  load(context: ExerciseContext): void {
    this.payload.set(null);
    this.error.set('');
    this.completed.set(context.state === 'completed');
    if (this.completed()) return;

    try {
      this.payload.set(parseIeltsListeningExercisePayload(context.payload));
    } catch {
      this.error.set('IELTS listening exercise data is unavailable.');
    }
  }

  onAttemptSubmitted(event: { attemptId: string }): void {
    const attemptId = String(event?.attemptId ?? '').trim();
    if (!attemptId || attemptId.length > 64) {
      this.error.set('Listening completion evidence is unavailable.');
      return;
    }
    this.outcome.emit({ kind: 'completed', evidence: { attemptId } });
  }
}
