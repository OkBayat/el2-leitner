import type { Type } from '@angular/core';
import type { ExerciseComponent } from './exercise-contracts';

export type ExerciseComponentLoader = () => Promise<Type<ExerciseComponent>>;

export interface ExerciseRenderer {
  readonly type: string;
  readonly loadComponent: ExerciseComponentLoader;
}

export class ExerciseRegistry {
  private readonly renderers = new Map<string, ExerciseComponentLoader>();

  register(renderer: ExerciseRenderer): void {
    this.renderers.set(renderer.type, renderer.loadComponent);
  }

  resolve(type: string): ExerciseComponentLoader | undefined {
    return this.renderers.get(type);
  }
}
