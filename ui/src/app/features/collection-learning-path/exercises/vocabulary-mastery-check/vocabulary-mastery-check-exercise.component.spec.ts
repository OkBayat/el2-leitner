import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ReviewSessionService } from '../../../../application/review/review-session.service';
import { CollectionLearningPathApiService } from '../../../../core/collection-learning-path/collection-learning-path-api.service';
import { VocabularyMasteryCheckExerciseComponent } from './vocabulary-mastery-check-exercise.component';

function context(items: Array<{ id: string; term: string }> = [{ id: 'word-1', term: 'persistent' }]) {
  return {
    pathId: 'path-1',
    lessonId: 'lesson-1',
    exerciseId: 'mastery-1',
    type: 'vocabulary.mastery-check',
    schemaVersion: 1,
    config: { scope: { kind: 'listening-episode', ref: 'episode-1' } },
    payload: {
      scope: { kind: 'listening-episode', ref: 'episode-1' },
      items,
      summary: { eligibleCount: items.length },
    },
  };
}

function sessionFake() {
  const currentWord = signal<any>({ id: 'word-1', term: 'persistent' });
  const feedback = signal<any>(null);
  const canAdvance = signal(false);
  const completed = signal(false);
  const completedSessionId = signal<string | null>(null);
  const initialCount = signal(1);
  const answered = signal(0);
  const correct = signal(0);
  const wrong = signal(0);
  const startScopedMasteryCheck = vi.fn().mockResolvedValue(true);
  const submit = vi.fn().mockImplementation(async (_answer: string, forcedWrong: boolean) => {
    answered.set(1);
    correct.set(forcedWrong ? 0 : 1);
    wrong.set(forcedWrong ? 1 : 0);
    feedback.set({ correct: !forcedWrong, title: 'Recorded', detail: forcedWrong ? 'The word returned to House 1.' : 'Mastery retained.', spelling: 'persistent' });
    canAdvance.set(true);
  });
  const next = vi.fn().mockImplementation(async () => {
    currentWord.set(null);
    completed.set(true);
    completedSessionId.set('session-1');
  });
  return {
    currentWord,
    feedback,
    canAdvance,
    completed,
    completedSessionId,
    initialCount,
    answered,
    correct,
    wrong,
    startScopedMasteryCheck,
    submit,
    next,
    pronounce: vi.fn(),
  };
}

describe('VocabularyMasteryCheckExerciseComponent', () => {
  it('starts the server-authoritative mastery snapshot and emits its completed session as evidence', async () => {
    const session = sessionFake();
    const api = {
      commandStartVocabularyMasteryCheck: vi.fn().mockResolvedValue({
        pathId: 'path-1', lessonId: 'lesson-1', exerciseId: 'mastery-1',
        session: { id: 'session-1', mode: 'learning-path.mastery-check', status: 'active', plannedCount: 1 },
        payload: context().payload,
      }),
    };
    TestBed.configureTestingModule({
      imports: [VocabularyMasteryCheckExerciseComponent],
      providers: [
        { provide: ReviewSessionService, useValue: session },
        { provide: CollectionLearningPathApiService, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(VocabularyMasteryCheckExerciseComponent);
    const component = fixture.componentInstance;
    const outcomes: unknown[] = [];
    component.outcome.subscribe((value) => outcomes.push(value));
    component.load(context());

    await component.start();
    expect(api.commandStartVocabularyMasteryCheck).toHaveBeenCalledWith('path-1', 'lesson-1', 'mastery-1');
    expect(session.startScopedMasteryCheck).toHaveBeenCalledWith(['word-1'], 'session-1');

    await component.mark(false);
    expect(session.submit).toHaveBeenCalledWith('', true);
    await component.next();
    expect(outcomes).toEqual([{ kind: 'completed', evidence: { sessionId: 'session-1' } }]);
  });

  it('completes an empty mastery scope without opening a practice session', async () => {
    const session = sessionFake();
    const api = { commandStartVocabularyMasteryCheck: vi.fn() };
    TestBed.configureTestingModule({
      imports: [VocabularyMasteryCheckExerciseComponent],
      providers: [
        { provide: ReviewSessionService, useValue: session },
        { provide: CollectionLearningPathApiService, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(VocabularyMasteryCheckExerciseComponent);
    const component = fixture.componentInstance;
    const outcomes: unknown[] = [];
    component.outcome.subscribe((value) => outcomes.push(value));
    component.load(context([]));

    await component.start();

    expect(api.commandStartVocabularyMasteryCheck).not.toHaveBeenCalled();
    expect(session.startScopedMasteryCheck).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ kind: 'completed', evidence: { empty: true } }]);
  });
});
