import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import type { ExerciseContextView } from '../../../../domain/collection-learning-path/learning-path';
import type { ExerciseComponent, ExerciseContext, ExerciseOutcome } from './exercise-contracts';
import { createLearningPathExerciseRegistry } from './learning-path-exercise-registry';
import { UnsupportedExerciseComponent } from './unsupported-exercise.component';

function runtimeContext(context: ExerciseContextView): ExerciseContext {
  return {
    pathId: context.path.id,
    lessonId: context.lesson.id,
    exerciseId: context.exercise.id,
    type: context.exercise.type,
    schemaVersion: context.exercise.schemaVersion,
    state: context.state,
    config: context.exercise.config,
    payload: context.payload,
  };
}

@Component({
  selector: 'app-learning-path-exercise-host',
  standalone: true,
  imports: [UnsupportedExerciseComponent],
  templateUrl: './exercise-host.component.html',
  styleUrl: './exercise-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseHostComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) context!: ExerciseContextView;
  @Output() readonly outcome = new EventEmitter<ExerciseOutcome>();
  @ViewChild('outlet', { read: ViewContainerRef, static: true }) private outlet!: ViewContainerRef;

  unsupportedType = '';
  private readonly registry = createLearningPathExerciseRegistry();
  private componentRef: ComponentRef<ExerciseComponent> | null = null;
  private outcomeSubscription: Subscription | null = null;
  private initialized = false;

  ngOnInit(): void {
    this.initialized = true;
    this.render();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.initialized) this.render();
  }

  ngOnDestroy(): void {
    this.disposeRenderer();
  }

  private render(): void {
    this.disposeRenderer();
    const renderer = this.registry.resolve(this.context.exercise.type);
    if (!renderer) {
      this.unsupportedType = this.context.exercise.type;
      return;
    }
    this.unsupportedType = '';
    this.componentRef = this.outlet.createComponent(renderer);
    this.componentRef.instance.load(runtimeContext(this.context));
    this.outcomeSubscription = this.componentRef.instance.outcome.subscribe((outcome) => this.outcome.emit(outcome));
  }

  private disposeRenderer(): void {
    this.outcomeSubscription?.unsubscribe();
    this.outcomeSubscription = null;
    this.outlet?.clear();
    this.componentRef = null;
  }
}
