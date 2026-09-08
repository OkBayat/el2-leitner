import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathFacade } from '../../../application/collection-learning-path/collection-learning-path.facade';
import type { CollectionLearningPathView, LearningPathLessonView } from '../../../domain/collection-learning-path/learning-path';
import { LearningPathPageComponent } from './learning-path-page.component';

function lesson(position: number): LearningPathLessonView {
  return {
    id: `unit-${position}`,
    title: `Unit ${position}`,
    position,
    sourceKind: 'collection-section',
    sourceRef: `section-${position}`,
    state: position === 1 ? 'available' : 'locked',
    progress: null,
    exercises: [{
      id: `unit-${position}-intake`,
      position: 1,
      type: 'vocabulary.intake',
      schemaVersion: 1,
      required: true,
      completionPolicy: 'vocabulary-intake',
      config: { scope: { kind: 'collection-section', ref: `section-${position}` } },
      state: position === 1 ? 'available' : 'locked',
      progress: null,
    }],
  };
}

function largeCambridgeView(): CollectionLearningPathView {
  return {
    access: { canProgress: true },
    resumePoint: { lessonId: 'unit-1', exerciseId: 'unit-1-intake' },
    path: {
      id: '1',
      collectionId: 'cambridge-vocabulary-for-ielts',
      title: 'Cambridge Vocabulary for IELTS',
      mode: 'finite',
      status: 'published',
      contentVersion: '2',
      learnerStatus: 'available',
      progress: null,
    },
    lessons: Array.from({ length: 120 }, (_, index) => lesson(index + 1)),
  };
}

describe('LearningPathPageComponent hardening', () => {
  it('renders long courses in bounded batches and exposes an accessible load-more control', async () => {
    const view = largeCambridgeView();
    const facade = {
      view: signal(view),
      resume: signal(null),
      loading: signal(false),
      starting: signal(false),
      error: signal(''),
      load: vi.fn().mockResolvedValue(true),
      loadByPathId: vi.fn().mockResolvedValue(true),
      start: vi.fn().mockResolvedValue(true),
    };
    TestBed.configureTestingModule({
      imports: [LearningPathPageComponent],
      providers: [
        provideRouter([]),
        { provide: CollectionLearningPathFacade, useValue: facade },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ pathId: view.path.id })) } },
      ],
    });

    const fixture = TestBed.createComponent(LearningPathPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('app-learning-path-lesson-node')).toHaveLength(40);
    const loadMore = element.querySelector<HTMLButtonElement>('[data-testid="load-more-lessons"]');
    expect(loadMore).not.toBeNull();
    expect(loadMore?.getAttribute('aria-label')).toContain('40 more lessons');

    loadMore?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('app-learning-path-lesson-node')).toHaveLength(80);
  });
});
