import type { Type } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import type { ExerciseComponent } from './exercise-contracts';
import { ExerciseRegistry } from './exercise-registry';

describe('ExerciseRegistry hardening', () => {
  it('stores lazy component loaders without loading an exercise chunk during registry creation', async () => {
    const renderer = class {} as unknown as Type<ExerciseComponent>;
    const loadComponent = vi.fn().mockResolvedValue(renderer);
    const registry = new ExerciseRegistry();

    registry.register({ type: 'fixture.lazy', loadComponent });

    const resolved = registry.resolve('fixture.lazy');
    expect(loadComponent).not.toHaveBeenCalled();
    expect(resolved).toBeTypeOf('function');
    await expect(resolved?.()).resolves.toBe(renderer);
    expect(loadComponent).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for unknown exercise types so the host can render a safe fallback', () => {
    expect(new ExerciseRegistry().resolve('future.exercise')).toBeUndefined();
  });
});
