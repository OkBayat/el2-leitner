import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { VocabularyIntakeFacade } from '../../../../application/collection-learning-path/vocabulary-intake.facade';
import type { ChoiceSlideData } from '../../../../shared/slide-exercise';
import { VocabularyIntakeExerciseComponent } from './vocabulary-intake-exercise.component';
import { VOCABULARY_INTAKE_SUMMARY_SLIDE_ID } from './vocabulary-intake-slide.factory';

const runtimeContext = {
  pathId: 'cvfi-learning-path',
  lessonId: 'cvfi-unit-01',
  exerciseId: 'cvfi-u01-intake',
  type: 'vocabulary.intake',
  schemaVersion: 1,
  config: { scope: { kind: 'lesson-source' } },
  payload: {
    scope: { kind: 'collection-section', ref: 'cvfi-unit-01' },
    items: [
      { id: 'new-1', term: 'persistent', definitions: ['continuing for a long time'], examples: [], progress: { state: 'new', box: 0 } },
      { id: 'box-1', term: 'establish', definitions: ['to create or set up'], examples: [], progress: { state: 'learning', box: 1 } },
      { id: 'box-2', term: 'vary', definitions: ['to be different'], examples: [], progress: { state: 'learning', box: 2 } },
      { id: 'mastered', term: 'mature', definitions: ['fully developed'], examples: [], progress: { state: 'mastered', box: 5 } },
      { id: 'excluded', term: 'omit', definitions: ['to leave out'], examples: [], progress: { state: 'excluded', box: 0 } },
    ],
    summary: { total: 5, newCount: 1, learningCount: 2, masteredCount: 1, excludedCount: 1 },
  },
};

describe('VocabularyIntakeExerciseComponent', () => {
  it('starts with a report, activates scoped new words, then opens only new and Box 1 questions', async () => {
    const activate = vi.fn().mockResolvedValue({ activatedCount: 1 });
    TestBed.configureTestingModule({
      imports: [VocabularyIntakeExerciseComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate } }],
    });
    const fixture = TestBed.createComponent(VocabularyIntakeExerciseComponent);
    const component = fixture.componentInstance;
    component.load(runtimeContext);
    fixture.detectChanges();

    const slides = component.slides();
    expect(slides[0].chrome?.header?.visible).toBe(false);
    expect((slides[0].data as { body: string }).body).toBe('5 words · 1 mastered · 2 to practice');
    expect(slides.filter((slide) => slide.type === 'choice').map((slide) => (slide.data as ChoiceSlideData).question))
      .toEqual(['persistent', 'establish']);

    await component.startPractice();

    expect(activate).toHaveBeenCalledWith('cvfi-learning-path', 'cvfi-unit-01', 'cvfi-u01-intake');
    expect(component.error()).toBe('');
  });

  it('records each question once and prepares the final correct/incorrect summary', () => {
    TestBed.configureTestingModule({
      imports: [VocabularyIntakeExerciseComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate: vi.fn() } }],
    });
    const component = TestBed.createComponent(VocabularyIntakeExerciseComponent).componentInstance;
    component.load(runtimeContext);
    component.onContentEvent({
      slideId: 'vocabulary-intake-question-new-1',
      type: 'answered',
      data: { selectedOptionIds: ['a'], correctOptionIds: ['a'], correct: true },
    });
    component.onContentEvent({
      slideId: 'vocabulary-intake-question-new-1',
      type: 'answered',
      data: { selectedOptionIds: ['a'], correctOptionIds: ['a'], correct: true },
    });
    component.onContentEvent({
      slideId: 'vocabulary-intake-question-box-1',
      type: 'answered',
      data: { selectedOptionIds: ['b'], correctOptionIds: ['a'], correct: false },
    });

    expect(component.correctCount()).toBe(1);
    expect(component.incorrectCount()).toBe(1);
    const summary = component.slides().find((slide) => slide.id === VOCABULARY_INTAKE_SUMMARY_SLIDE_ID)!;
    expect((summary.data as { metrics: Array<{ label: string; value: number }> }).metrics).toEqual([
      { label: 'Correct', value: 1 },
      { label: 'Incorrect', value: 1 },
    ]);
  });

  it('stays on the intro and exposes retry feedback when activation fails', async () => {
    const activate = vi.fn().mockRejectedValue(new Error('activation failed'));
    TestBed.configureTestingModule({
      imports: [VocabularyIntakeExerciseComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate } }],
    });
    const component = TestBed.createComponent(VocabularyIntakeExerciseComponent).componentInstance;
    component.load(runtimeContext);

    await component.startPractice();

    expect(component.error()).toBe('activation failed');
    expect(component.chromeDefaults().footer).toMatchObject({ tone: 'error', title: 'Could not start practice' });
  });

  it('emits completion only when the slide exercise reaches its end', () => {
    TestBed.configureTestingModule({
      imports: [VocabularyIntakeExerciseComponent],
      providers: [{ provide: VocabularyIntakeFacade, useValue: { activate: vi.fn() } }],
    });
    const component = TestBed.createComponent(VocabularyIntakeExerciseComponent).componentInstance;
    const outcomes: unknown[] = [];
    component.outcome.subscribe((outcome) => outcomes.push(outcome));
    component.complete();
    expect(outcomes).toEqual([{ kind: 'completed' }]);
  });
});
