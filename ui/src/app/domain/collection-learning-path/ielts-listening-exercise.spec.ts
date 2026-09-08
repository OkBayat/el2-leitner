import { describe, expect, it } from 'vitest';
import { parseIeltsListeningExercisePayload } from './ielts-listening-exercise';

describe('IELTS listening Learning Path payload', () => {
  it('accepts a hydrated listening lesson and test reference', () => {
    const payload = parseIeltsListeningExercisePayload({
      reference: { lessonSlug: 'climate-change', testId: 'test-2' },
      lesson: { id: 'lesson-1', slug: 'climate-change', title: 'Climate change' },
      test: { id: 'test-2', title: 'Test 2', groups: [] },
    });

    expect(payload.reference).toEqual({ lessonSlug: 'climate-change', testId: 'test-2' });
    expect(payload.lesson.slug).toBe('climate-change');
    expect(payload.test.id).toBe('test-2');
  });

  it('rejects malformed or mismatched listening payloads', () => {
    for (const value of [
      null,
      {},
      { reference: { lessonSlug: '', testId: 'test-2' }, lesson: {}, test: {} },
      { reference: { lessonSlug: 'climate-change', testId: 'test-2' }, lesson: { slug: 'other' }, test: { id: 'test-2' } },
      { reference: { lessonSlug: 'climate-change', testId: 'test-2' }, lesson: { slug: 'climate-change' }, test: { id: 'test-3' } },
    ]) {
      expect(() => parseIeltsListeningExercisePayload(value)).toThrow('IELTS listening exercise data is invalid.');
    }
  });
});
