import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { LearningPathPathView, LearningPathLessonView } from '../../../../domain/collection-learning-path/learning-path';
import { ProgressHeaderComponent } from './progress-header.component';

const path: LearningPathPathView = { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', status: 'published', contentVersion: 'v1', learnerStatus: 'in_progress', progress: null };
const lessons: LearningPathLessonView[] = [{ id: 'lesson-1', title: 'Lesson 1', position: 1, sourceKind: null, sourceRef: null, state: 'in_progress', progress: null, exercises: [{ id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'explicit', config: {}, state: 'completed', progress: null }, { id: 'exercise-2', position: 2, type: 'listening.ielts', schemaVersion: 1, required: true, completionPolicy: 'listening', config: {}, state: 'available', progress: null }] }];

describe('ProgressHeaderComponent', () => {
  it('renders server status and an accessible required-exercise progress bar', () => {
    TestBed.configureTestingModule({ imports: [ProgressHeaderComponent] });
    const fixture = TestBed.createComponent(ProgressHeaderComponent);
    fixture.componentRef.setInput('path', path); fixture.componentRef.setInput('lessons', lessons); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Course');
    expect(element.textContent).toContain('In progress');
    const bar = element.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('50');
    expect(bar?.getAttribute('aria-valuemax')).toBe('100');
  });
});
