import { Type } from '@angular/core';
import { ExerciseComponent } from './exercise-contracts';

export interface ExerciseRenderer {
  readonly type: string;
  readonly component: Type<ExerciseComponent>;
}

export class ExerciseRegistry {
  private readonly renderers = new Map<string, Type<ExerciseComponent>>();

  register(renderer: ExerciseRenderer): void {
    this.renderers.set(renderer.type, renderer.component);
  }

  resolve(type: string): Type<ExerciseComponent> | undefined {
    return this.renderers.get(type);
  }
}
