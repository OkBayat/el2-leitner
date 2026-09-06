import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-unsupported-exercise',
  standalone: true,
  templateUrl: './unsupported-exercise.component.html',
  styleUrl: './unsupported-exercise.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnsupportedExerciseComponent {
  @Input({ required: true }) type!: string;
}
