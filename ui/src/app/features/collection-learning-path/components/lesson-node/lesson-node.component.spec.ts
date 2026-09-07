import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { LearningPathLessonView } from '../../../../domain/collection-learning-path/learning-path';
import { LessonNodeComponent } from './lesson-node.component';

const lesson: LearningPathLessonView = { id: 'lesson-1', title: 'Lesson 1', position: 1, sourceKind: null, sourceRef: null, state: 'in_progress', progress: null, exercises: [{ id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'explicit', config: {}, state: 'available', progress: null }] };

describe('LessonNodeComponent', () => {
  it('renders each lesson as a lesson-first trail and forwards exercise selection with lesson identity', () => {
    TestBed.configureTestingModule({ imports: [LessonNodeComponent] });
    const fixture = TestBed.createComponent(LessonNodeComponent);
    fixture.componentRef.setInput('lesson', lesson); fixture.detectChanges();
    const selected = vi.fn(); fixture.componentInstance.selectExercise.subscribe(selected);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.lesson')?.classList.contains('is-active')).toBe(true);
    expect(element.querySelector('.lesson')?.getAttribute('data-palette')).toBe('green');
    expect(element.querySelector('[data-testid="lesson-trail"]')).not.toBeNull();
    expect(element.textContent).toContain('Lesson 1');
    (element.querySelector('button') as HTMLButtonElement).click();
    expect(selected).toHaveBeenCalledWith({ lessonId: 'lesson-1', exerciseId: 'exercise-1' });
  });

  it('mirrors alternate lessons and rotates their trail palette', () => {
    TestBed.configureTestingModule({ imports: [LessonNodeComponent] });
    const fixture = TestBed.createComponent(LessonNodeComponent);
    fixture.componentRef.setInput('lesson', { ...lesson, id: 'lesson-2', position: 2, state: 'locked' }); fixture.detectChanges();
    const element = (fixture.nativeElement as HTMLElement).querySelector('.lesson');
    expect(element?.classList.contains('is-mirrored')).toBe(true);
    expect(element?.getAttribute('data-palette')).toBe('purple');
  });
});
