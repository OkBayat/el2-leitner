import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseRunnerFacade } from '../../../application/collection-learning-path/exercise-runner.facade';
import { VocabularyIntakeFacade } from '../../../application/collection-learning-path/vocabulary-intake.facade';
import type { ExerciseContextView } from '../../../domain/collection-learning-path/learning-path';
import { ExerciseRunnerPageComponent } from './exercise-runner-page.component';

const context: ExerciseContextView = {
  path: { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', contentVersion: 'v1' },
  lesson: { id: 'lesson-1', title: 'Lesson 1', position: 1 },
  exercise: { id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'vocabulary-intake', config: { scope: { kind: 'listening-episode', ref: 'episode-1' } } },
  progress: null,
  state: 'in_progress',
  payload: {
    scope: { kind: 'listening-episode', ref: 'episode-1' },
    items: [
      { id: 'v-1', term: 'persistent', definitions: ['continuing'], examples: [], progress: { state: 'new', box: 0 } },
      { id: 'v-2', term: 'noticeable', definitions: ['easy to notice'], examples: [], progress: { state: 'mastered', box: 5 } },
      { id: 'v-3', term: 'variable', definitions: ['likely to change'], examples: [], progress: { state: 'excluded', box: 0 } },
    ],
    summary: { total: 3, newCount: 1, learningCount: 0, masteredCount: 1, excludedCount: 1 },
  },
};

describe('ExerciseRunnerPageComponent', () => {
  it('loads authoritative context and hosts the registered slide-based vocabulary renderer', async () => {
    const facade = { context: signal(context), loading: signal(false), error: signal(''), load: vi.fn().mockResolvedValue(true), complete: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [ExerciseRunnerPageComponent],
      providers: [provideRouter([]), { provide: ExerciseRunnerFacade, useValue: facade }, { provide: VocabularyIntakeFacade, useValue: { activate: vi.fn().mockResolvedValue({ activatedCount: 1 }) } }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ pathId: 'path-1', lessonId: 'lesson-1', exerciseId: 'exercise-1' })) } }],
    });
    const fixture = TestBed.createComponent(ExerciseRunnerPageComponent);
    fixture.detectChanges();

    expect(facade.load).toHaveBeenCalledWith('path-1', 'lesson-1', 'exercise-1');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="learning-path-runner"]')).not.toBeNull();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('[data-testid="vocabulary-intake"]')).not.toBeNull();
      expect(element.querySelector('[data-testid="slide-exercise"]')).not.toBeNull();
      expect(element.textContent).toContain('Ready to practice?');
      expect(element.textContent).toContain('3 words · 1 mastered · 1 to practice');
    }, { timeout: 2000 });
  });

  it('forwards completed renderer outcomes to the generic runner completion command', () => {
    const facade = { context: signal(context), loading: signal(false), error: signal(''), load: vi.fn().mockResolvedValue(true), complete: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({ imports: [ExerciseRunnerPageComponent], providers: [provideRouter([]), { provide: ExerciseRunnerFacade, useValue: facade }, { provide: VocabularyIntakeFacade, useValue: { activate: vi.fn() } }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ pathId: 'path-1', lessonId: 'lesson-1', exerciseId: 'exercise-1' })) } }] });
    const fixture = TestBed.createComponent(ExerciseRunnerPageComponent);
    fixture.componentInstance.onExerciseOutcome({ kind: 'completed' });
    expect(facade.complete).toHaveBeenCalledWith({ kind: 'completed' });
  });
});
