import { ChangeDetectionStrategy, Component, EventEmitter, Output, signal } from '@angular/core';
import { ShadowingPageComponent } from '../../../shadowing-practice/shadowing-page.component';
import type { ExerciseComponent, ExerciseContext, ExerciseOutcome } from '../exercise-runtime/exercise-contracts';

@Component({
  selector: 'app-learning-path-shadowing-exercise',
  standalone: true,
  imports: [ShadowingPageComponent],
  templateUrl: './shadowing-exercise.component.html',
  styleUrl: './shadowing-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShadowingExerciseComponent implements ExerciseComponent {
  private readonly context = signal<ExerciseContext | null>(null);
  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();

  load(context: ExerciseContext): void { this.context.set(context); }
  complete(sessionId: string): void {
    if (!this.context() || !sessionId.trim()) return;
    this.outcome.emit({ kind: 'completed', evidence: { sessionId: sessionId.trim() } });
  }
  cancel(): void { this.outcome.emit({ kind: 'cancelled' }); }
}
