import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { LearningPathLessonView } from '../../../../domain/collection-learning-path/learning-path';
import { LessonNodeComponent } from './lesson-node.component';

const lesson: LearningPathLessonView = { id: 'lesson-1', title: 'Lesson 1', position: 1, sourceKind: null, sourceRef: null, state: 'in_progress', progress: null, exercises: [{ id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'explicit', config: {}, state: 'available', progress: null }] };

describe('LessonNodeComponent', () => {
  it('renders ordered exercises and forwards an exercise selection with its lesson identity', () => {
    TestBed.configureTestingModule({ imports: [LessonNodeComponent] });
    const fixture = TestBed.createComponent(LessonNodeComponent);
    fixture.componentRef.setInput('lesson', lesson); fixture.detectChanges();
    const selected = vi.fn(); fixture.componentInstance.selectExercise.subscribe(selected);
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(fixture.nativeElement.textContent).toContain('Lesson 1');
    expect(selected).toHaveBeenCalledWith({ lessonId: 'lesson-1', exerciseId: 'exercise-1' });
  });
});
