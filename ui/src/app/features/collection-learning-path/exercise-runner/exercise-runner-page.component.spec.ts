import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseRunnerFacade } from '../../../application/collection-learning-path/exercise-runner.facade';
import type { ExerciseContextView } from '../../../domain/collection-learning-path/learning-path';
import { ExerciseRunnerPageComponent } from './exercise-runner-page.component';

const context: ExerciseContextView = { path: { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', contentVersion: 'v1' }, lesson: { id: 'lesson-1', title: 'Lesson 1', position: 1 }, exercise: { id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'explicit', config: {} }, progress: null, state: 'in_progress', payload: null };

describe('ExerciseRunnerPageComponent', () => {
  it('loads the authoritative exercise context and renders a distraction-free shell', async () => {
    const facade = { context: signal(context), loading: signal(false), error: signal(''), load: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({ imports: [ExerciseRunnerPageComponent], providers: [provideRouter([]), { provide: ExerciseRunnerFacade, useValue: facade }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ pathId: 'path-1', lessonId: 'lesson-1', exerciseId: 'exercise-1' })) } }] });
    const fixture = TestBed.createComponent(ExerciseRunnerPageComponent); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(facade.load).toHaveBeenCalledWith('path-1', 'lesson-1', 'exercise-1');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="learning-path-runner"]')).not.toBeNull();
    expect(element.textContent).toContain('Lesson 1');
    expect(element.textContent).toContain('Vocabulary intake');
  });
});
