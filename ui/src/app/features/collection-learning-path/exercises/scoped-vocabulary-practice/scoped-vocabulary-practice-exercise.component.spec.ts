import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ReviewSessionService } from '../../../../application/review/review-session.service';
import { ScopedVocabularyPracticeExerciseComponent } from './scoped-vocabulary-practice-exercise.component';

function context(items: Array<{ id: string; term: string }> = [{ id: 'word-1', term: 'persistent' }]) {
  return {
    pathId: 'path-1',
    lessonId: 'lesson-1',
    exerciseId: 'quick-1',
    type: 'vocabulary.quick-review',
    schemaVersion: 1,
    config: { scope: { kind: 'listening-episode', ref: 'episode-1' } },
    payload: {
      scope: { kind: 'listening-episode', ref: 'episode-1' },
      items,
      summary: { eligibleCount: items.length, box: 1 },
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
  const startScopedBoxOne = vi.fn().mockResolvedValue(true);
  const submit = vi.fn().mockImplementation(async () => {
    answered.set(1);
    feedback.set({ correct: true, title: 'Correct', detail: 'Practice recorded.', spelling: 'persistent' });
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
    startScopedBoxOne,
    submit,
    next,
    pronounce: vi.fn(),
  };
}

describe('ScopedVocabularyPracticeExerciseComponent', () => {
  it('starts a finite session with only server-scoped ids and emits persisted session evidence', async () => {
    const session = sessionFake();
    TestBed.configureTestingModule({
      imports: [ScopedVocabularyPracticeExerciseComponent],
      providers: [{ provide: ReviewSessionService, useValue: session }],
    });
    const fixture = TestBed.createComponent(ScopedVocabularyPracticeExerciseComponent);
    const component = fixture.componentInstance;
    const outcomes: unknown[] = [];
    component.outcome.subscribe((value) => outcomes.push(value));
    component.load(context([{ id: 'word-1', term: 'persistent' }]));

    await component.start();
    expect(session.startScopedBoxOne).toHaveBeenCalledWith(['word-1']);
    expect(session.pronounce).toHaveBeenCalled();

    await component.mark(true);
    expect(session.submit).toHaveBeenCalledWith('persistent', false);

    await component.next();
    expect(outcomes).toEqual([{ kind: 'completed', evidence: { sessionId: 'session-1' } }]);
  });

  it('completes an empty scoped queue without creating a practice session', async () => {
    const session = sessionFake();
    TestBed.configureTestingModule({
      imports: [ScopedVocabularyPracticeExerciseComponent],
      providers: [{ provide: ReviewSessionService, useValue: session }],
    });
    const fixture = TestBed.createComponent(ScopedVocabularyPracticeExerciseComponent);
    const component = fixture.componentInstance;
    const outcomes: unknown[] = [];
    component.outcome.subscribe((value) => outcomes.push(value));
    component.load(context([]));

    await component.start();

    expect(session.startScopedBoxOne).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ kind: 'completed', evidence: { empty: true } }]);
  });
});
