import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {of} from 'rxjs';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {LibraryLearningPathJourneyFacade} from '../../application/collection-learning-path/library-learning-path-journey.facade';
import {SelectedCoursesFacade} from '../../application/collection-learning-path/selected-courses.facade';
import {LibraryApiService} from '../../core/library/library-api.service';
import type {CollectionLearningPathView} from '../../domain/collection-learning-path/learning-path';
import type {LibraryCollection} from '../../domain/learning/models';
import {LibraryDetailPageComponent} from './library-detail-page.component';

function collection(overrides: Partial<LibraryCollection> = {}): LibraryCollection {
  return {
    id: 'collection-1',
    slug: 'collection-1',
    title: 'Vocabulary Collection',
    description: 'Existing collection description.',
    kind: 'book',
    visibility: 'public',
    status: 'published',
    contentVersion: 3,
    wordCount: 1,
    subscribed: false,
    entries: [{
      id: 'entry-1',
      vocabularyId: 'word-1',
      term: 'evidence',
      primaryForm: 'evidence',
      acceptedForms: ['evidence'],
      sectionId: 'section-1',
      sectionPath: 'Unit 1',
      note: null,
      position: 1,
      introducedVersion: 1,
    }],
    ...overrides,
  };
}

function courseView(item: LibraryCollection): CollectionLearningPathView {
  return {
    access: {canProgress: item.subscribed},
    resumePoint: {lessonId: 'lesson-1', exerciseId: 'exercise-1'},
    path: {
      id: 'path-1',
      collectionId: item.id,
      title: item.title,
      mode: 'finite',
      status: 'published',
      contentVersion: '1',
      learnerStatus: 'available',
      progress: null,
    },
    lessons: [],
  };
}

describe('LibraryDetailPageComponent', () => {
  const api = {
    get: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    update: vi.fn(),
    import: vi.fn(),
    addEntry: vi.fn(),
    updateEntry: vi.fn(),
    removeEntry: vi.fn(),
  };
  const navigate = vi.fn();
  const loadSelectedCourses = vi.fn(async () => true);
  const loadCatalog = vi.fn(async () => true);
  const loadCourse = vi.fn(async () => true);
  const removeEnrollment = vi.fn(async () => true);
  const enter = vi.fn();
  const journeyError = signal('');
  const catalogReady = signal(true);
  let activeCourse: CollectionLearningPathView | null = null;

  beforeEach(async () => {
    vi.clearAllMocks();
    for (const mock of Object.values(api)) mock.mockReset();
    activeCourse = null;
    journeyError.set('');
    catalogReady.set(true);
    await TestBed.configureTestingModule({
      imports: [LibraryDetailPageComponent],
      providers: [
        {provide: ActivatedRoute, useValue: {snapshot: {paramMap: {get: () => 'collection-1'}}}},
        {provide: Router, useValue: {navigate}},
        {provide: MatDialog, useValue: {open: vi.fn()}},
        {provide: MatSnackBar, useValue: {open: vi.fn()}},
        {provide: LibraryApiService, useValue: api},
        {provide: SelectedCoursesFacade, useValue: {load: loadSelectedCourses}},
        {
          provide: LibraryLearningPathJourneyFacade,
          useValue: {
            enteringId: signal<string | null>(null),
            error: journeyError,
            catalogReady,
            loadCatalog,
            load: loadCourse,
            enter,
            removeEnrollment,
            courseSummaryFor: () => activeCourse ? {
              collectionId: activeCourse.path.collectionId,
              pathId: activeCourse.path.id,
              title: activeCourse.path.title,
              learnerStatus: activeCourse.path.learnerStatus,
              enrolled: activeCourse.path.learnerStatus !== 'available',
            } : null,
            viewFor: () => activeCourse,
          },
        },
      ],
    }).compileComponents();
  });

  async function render(item: LibraryCollection) {
    api.get.mockResolvedValue({collection: item, capabilities: {canManage: true}});
    const fixture = TestBed.createComponent(LibraryDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('starts a course from its detail page and opens its server resume point', async () => {
    const item = collection({title: 'Structured Course'});
    activeCourse = courseView(item);
    enter.mockResolvedValue({kind: 'exercise', pathId: 'path-1', lessonId: 'lesson-1', exerciseId: 'exercise-1'});
    const fixture = await render(item);
    const host: HTMLElement = fixture.nativeElement;

    host.querySelector<HTMLButtonElement>('[data-testid="start-course-action"]')?.click();
    await fixture.whenStable();

    expect(enter).toHaveBeenCalledWith(item);
    expect(loadSelectedCourses).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith([
      '/learning-paths', 'path-1', 'lessons', 'lesson-1', 'exercises', 'exercise-1',
    ]);
  });

  it('adds course vocabulary to Leitner without starting or enrolling in the course', async () => {
    const item = collection({title: 'Optional Course Vocabulary'});
    activeCourse = courseView(item);
    api.get
      .mockResolvedValueOnce({collection: item, capabilities: {canManage: false}})
      .mockResolvedValueOnce({collection: {...item, subscribed: true}, capabilities: {canManage: false}});
    const fixture = await render(item);
    const host: HTMLElement = fixture.nativeElement;

    host.querySelector<HTMLButtonElement>('[data-testid="leitner-only-action"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.subscribe).toHaveBeenCalledWith(item.id);
    expect(enter).not.toHaveBeenCalled();
    expect(activeCourse.path.learnerStatus).toBe('available');
  });

  it('adds a standalone collection to Leitner and preserves existing detail content and management actions', async () => {
    const item = collection();
    const fixture = await render(item);
    const host: HTMLElement = fixture.nativeElement;

    expect(host.textContent).toContain('Existing collection description.');
    expect(host.textContent).toContain('version 3');
    expect(host.textContent).toContain('evidence');
    expect(host.textContent).toContain('Edit collection');
    expect(host.textContent).toContain('Import file');
    expect(host.textContent).toContain('Add word');

    host.querySelector<HTMLButtonElement>('[data-testid="leitner-only-action"]')?.click();
    await fixture.whenStable();

    expect(api.subscribe).toHaveBeenCalledWith(item.id);
    expect(enter).not.toHaveBeenCalled();
  });

  it('removes a standalone collection from Leitner through the same detail action area', async () => {
    const item = collection({subscribed: true});
    api.get
      .mockResolvedValueOnce({collection: item, capabilities: {canManage: false}})
      .mockResolvedValueOnce({collection: {...item, subscribed: false}, capabilities: {canManage: false}});
    const fixture = await render(item);
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('[data-testid="leitner-only-action"]')?.textContent).toContain('Remove from Leitner');
    host.querySelector<HTMLButtonElement>('[data-testid="leitner-only-action"]')?.click();
    await fixture.whenStable();

    expect(api.unsubscribe).toHaveBeenCalledWith(item.id);
    expect(loadSelectedCourses).toHaveBeenCalled();
  });

  it('fails closed and retries when course discovery fails', async () => {
    const item = collection();
    loadCatalog.mockImplementationOnce(async () => {
      catalogReady.set(false);
      journeyError.set('Courses could not load. Try again.');
      return false;
    }).mockImplementationOnce(async () => {
      journeyError.set('');
      catalogReady.set(true);
      return true;
    });
    const fixture = await render(item);
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Courses could not load');
    expect(host.querySelector('[data-testid="leitner-only-action"]')).toBeNull();

    host.querySelector<HTMLButtonElement>('[data-testid="course-detail-retry"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(loadCatalog).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="leitner-only-action"]')).not.toBeNull();
  });

  it('removes course enrollment without changing its Leitner subscription', async () => {
    const item = collection({subscribed: true});
    activeCourse = courseView(item);
    activeCourse.path.learnerStatus = 'in_progress';
    const dialog = TestBed.inject(MatDialog);
    vi.mocked(dialog.open).mockReturnValue({afterClosed: () => of(true)} as never);
    const fixture = await render(item);
    const host: HTMLElement = fixture.nativeElement;

    host.querySelector<HTMLButtonElement>('[data-testid="remove-course-action"]')?.click();
    await fixture.whenStable();

    expect(removeEnrollment).toHaveBeenCalledWith('path-1');
    expect(api.unsubscribe).not.toHaveBeenCalled();
    expect(loadSelectedCourses).toHaveBeenCalled();
  });
});
