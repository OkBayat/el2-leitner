import { describe, expect, it } from 'vitest';
import { learningPathPrimaryAction } from './learning-path';

describe('Learning Path journey primary action', () => {
  it('uses generic course labels for every learner state', () => {
    expect(learningPathPrimaryAction('available')).toEqual({ label: 'Start course', actionable: true });
    expect(learningPathPrimaryAction('in_progress')).toEqual({ label: 'Continue', actionable: true });
    expect(learningPathPrimaryAction('up_to_date')).toEqual({ label: 'Up to date', actionable: false });
    expect(learningPathPrimaryAction('completed')).toEqual({ label: 'Completed', actionable: false });
  });
});
