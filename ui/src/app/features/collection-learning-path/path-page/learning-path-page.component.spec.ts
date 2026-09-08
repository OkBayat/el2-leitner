import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathFacade } from '../../../application/collection-learning-path/collection-learning-path.facade';
import type { CollectionLearningPathView, LearningPathResumeView } from '../../../domain/collection-learning-path/learning-path';
import { LearningPathPageComponent } from './learning-path-page.component';

const view: CollectionLearningPathView = { access: { canProgress: true }, resumePoint: { lessonId: 'lesson-1', exerciseId: 'exercise-1' }, path: { id: 'path-1', collectionId: 'collection-1', title: 'Course', mode: 'finite', status: 'published', contentVersion: 'v1', learnerStatus: 'available', progress: null }, lessons: [{ id: 'lesson-1', title: 'Lesson 1', position: 1, sourceKind: null, sourceRef: null, state: 'available', progress: null, exercises: [{ id: 'exercise-1', position: 1, type: 'vocabulary.intake', schemaVersion: 1, required: true, completionPolicy: 'explicit', config: {}, state: 'available', progress: null }] }] };
const resume: LearningPathResumeView = { pathId: 'path-1', pathStatus: 'available', resumePoint: { lessonId: 'lesson-1', exerciseId: 'exercise-1' } };

describe('LearningPathPageComponent', () => {
  it('replaces the legacy collection route with the canonical public-id route', async () => {
    const numericView = { ...view, path: { ...view.path, id: '1' } };
    const facade = { view: signal(numericView), resume: signal(resume), loading: signal(false), starting: signal(false), error: signal(''), load: vi.fn().mockResolvedValue(true), loadByPathId: vi.fn(), start: vi.fn() };
    TestBed.configureTestingModule({ imports: [LearningPathPageComponent], providers: [provideRouter([]), { provide: CollectionLearningPathFacade, useValue: facade }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ collectionId: 'collection-1' })) } }] });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LearningPathPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(facade.load).toHaveBeenCalledWith('collection-1');
    expect(navigate).toHaveBeenCalledWith(['/learning-paths', '1'], { replaceUrl: true });
  });

  it('keeps the legacy collection route while an older backend still returns source ids', async () => {
    const facade = { view: signal(view), resume: signal(resume), loading: signal(false), starting: signal(false), error: signal(''), load: vi.fn().mockResolvedValue(true), loadByPathId: vi.fn(), start: vi.fn() };
    TestBed.configureTestingModule({ imports: [LearningPathPageComponent], providers: [provideRouter([]), { provide: CollectionLearningPathFacade, useValue: facade }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ collectionId: 'collection-1' })) } }] });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LearningPathPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(facade.load).toHaveBeenCalledWith('collection-1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('loads by public path id and starts an available path when its current trail node is opened', async () => {
    const facade = { view: signal(view), resume: signal(resume), loading: signal(false), starting: signal(false), error: signal(''), load: vi.fn().mockResolvedValue(true), loadByPathId: vi.fn().mockResolvedValue(true), start: vi.fn().mockImplementation(async () => { facade.resume.set({ ...resume, pathStatus: 'in_progress' }); return true; }) };
    TestBed.configureTestingModule({ imports: [LearningPathPageComponent], providers: [provideRouter([]), { provide: CollectionLearningPathFacade, useValue: facade }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ pathId: 'path-1' })) } }] });
    const fixture = TestBed.createComponent(LearningPathPageComponent); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(facade.loadByPathId).toHaveBeenCalledWith('path-1');
    expect(fixture.nativeElement.textContent).toContain('Lesson 1');
    expect(fixture.nativeElement.querySelector('[data-testid="lesson-trail"]')).not.toBeNull();
    const router = TestBed.inject(Router); vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.componentInstance.openExercise({ lessonId: 'lesson-1', exerciseId: 'exercise-1' });
    expect(facade.start).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/learning-paths', 'path-1', 'lessons', 'lesson-1', 'exercises', 'exercise-1']);
  });

  it('shows rolling terminal status without rendering a separate continue action', async () => {
    const terminalView: CollectionLearningPathView = { ...view, resumePoint: null, path: { ...view.path, mode: 'rolling', learnerStatus: 'up_to_date' }, lessons: [{ ...view.lessons[0], state: 'completed', exercises: [{ ...view.lessons[0].exercises[0], state: 'completed' }] }] };
    const facade = { view: signal(terminalView), resume: signal({ pathId: 'path-1', pathStatus: 'up_to_date' as const, resumePoint: null }), loading: signal(false), starting: signal(false), error: signal(''), load: vi.fn().mockResolvedValue(true), loadByPathId: vi.fn().mockResolvedValue(true), start: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [LearningPathPageComponent], providers: [provideRouter([]), { provide: CollectionLearningPathFacade, useValue: facade }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ pathId: 'path-1' })) } }] });
    const fixture = TestBed.createComponent(LearningPathPageComponent); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Up to date');
    expect(element.querySelector('.primary-action')).toBeNull();
  });
});
