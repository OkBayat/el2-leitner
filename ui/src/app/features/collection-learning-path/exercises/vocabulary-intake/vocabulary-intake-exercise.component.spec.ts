import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { VocabularyIntakeFacade } from '../../../../application/collection-learning-path/vocabulary-intake.facade';
import { VocabularyIntakeExerciseComponent } from './vocabulary-intake-exercise.component';

const runtimeContext = {
  pathId: 'path-1',
  lessonId: 'lesson-1',
  exerciseId: 'intake-1',
  type: 'vocabulary.intake',
  schemaVersion: 1,
  config: { scope: { kind: 'listening-episode', ref: 'episode-1' } },
  payload: {
    scope: { kind: 'listening-episode', ref: 'episode-1' },
    items: [
      { id: 'new-1', term: 'persistent', definitions: ['continuing for a long time'], examples: ['She made a persistent effort.'], progress: { state: 'new', box: 0 } },
      { id: 'old-1', term: 'establish', definitions: [], examples: [], progress: { state: 'learning', box: 3 } },
      { id: 'done-1', term: 'mastered', definitions: [], examples: [], progress: { state: 'mastered', box: 5 } },
      { id: 'skip-1', term: 'excluded', definitions: [], examples: [], progress: { state: 'excluded', box: 0 } },
    ],
    summary: { total: 4, newCount: 1, learningCount: 1, masteredCount: 1, excludedCount: 1 },
  },
};

describe('VocabularyIntakeExerciseComponent', () => {
  it('renders mixed global vocabulary states and emits completion only after activation succeeds', async () => {
    const activate = vi.fn().mockResolvedValue({ activatedCount: 1 });
    TestBed.configureTestingModule({
      imports: [VocabularyIntakeExerciseComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate } }],
    });
    const fixture = TestBed.createComponent(VocabularyIntakeExerciseComponent);
    const component = fixture.componentInstance;
    const outcomes: unknown[] = [];
    component.outcome.subscribe((outcome) => outcomes.push(outcome));
    component.load(runtimeContext);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('1 new');
    expect(element.textContent).toContain('Box 3');
    expect(element.textContent).toContain('Mastered');
    expect(element.textContent).toContain('Excluded');
    expect(element.querySelector('button')?.textContent).toContain('Add 1 new word');

    await component.finish();

    expect(activate).toHaveBeenCalledWith('path-1', 'lesson-1', 'intake-1');
    expect(outcomes).toEqual([{ kind: 'completed' }]);
  });

  it('does not emit completion when activation fails', async () => {
    const activate = vi.fn().mockRejectedValue(new Error('activation failed'));
    TestBed.configureTestingModule({
      imports: [VocabularyIntakeExerciseComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate } }],
    });
    const fixture = TestBed.createComponent(VocabularyIntakeExerciseComponent);
    const component = fixture.componentInstance;
    const outcomes: unknown[] = [];
    component.outcome.subscribe((outcome) => outcomes.push(outcome));
    component.load(runtimeContext);

    await component.finish();
    fixture.detectChanges();

    expect(outcomes).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('activation failed');
  });
});
