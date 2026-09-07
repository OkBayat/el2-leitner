import { describe, expect, it } from 'vitest';
import {
  buildExerciseStepSequence,
  normalizeExerciseProgress,
  resolveExerciseActionState,
  resolveExerciseStepHeaderMode,
  type ExerciseStepDefinition,
} from './exercise-layout.models';

function step(id: string, kind: ExerciseStepDefinition['kind']): ExerciseStepDefinition {
  return { id, kind };
}

describe('exercise layout flow', () => {
  it('keeps any number of custom steps around the practice and optional summary', () => {
    const sequence = buildExerciseStepSequence({
      before: [step('intro-1', 'introduction'), step('intro-2', 'custom')],
      practice: step('practice', 'practice'),
      summary: step('summary', 'summary'),
      after: [step('reflection', 'custom'), step('share', 'custom')],
    });

    expect(sequence.map((item) => item.id)).toEqual([
      'intro-1',
      'intro-2',
      'practice',
      'summary',
      'reflection',
      'share',
    ]);
  });

  it('supports the smallest flow with only the practice step', () => {
    const sequence = buildExerciseStepSequence({ practice: step('practice', 'practice') });
    expect(sequence).toEqual([{ id: 'practice', kind: 'practice' }]);
  });

  it('rejects duplicate step ids so navigation remains stable', () => {
    expect(() => buildExerciseStepSequence({
      before: [step('same', 'introduction')],
      practice: step('same', 'practice'),
    })).toThrow('Exercise step ids must be unique.');
  });

  it('hides the shared progress header for summary steps by default', () => {
    expect(resolveExerciseStepHeaderMode(step('summary', 'summary'))).toBe('hidden');
    expect(resolveExerciseStepHeaderMode(step('practice', 'practice'))).toBe('progress');
    expect(resolveExerciseStepHeaderMode({ ...step('intro', 'introduction'), headerMode: 'hidden' })).toBe('hidden');
  });

  it('clamps progress to the shared 0 to 100 contract', () => {
    expect(normalizeExerciseProgress(-10)).toBe(0);
    expect(normalizeExerciseProgress(42.5)).toBe(42.5);
    expect(normalizeExerciseProgress(150)).toBe(100);
  });

  it('uses one disabled action state regardless of the semantic active tone', () => {
    expect(resolveExerciseActionState('warning', false, false)).toBe('warning');
    expect(resolveExerciseActionState('error', true, false)).toBe('disabled');
    expect(resolveExerciseActionState('success', false, true)).toBe('disabled');
  });
});
