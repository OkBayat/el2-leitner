import {Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {LibraryLearningPathJourneyFacade} from '../../application/collection-learning-path/library-learning-path-journey.facade';
import {SelectedCoursesFacade} from '../../application/collection-learning-path/selected-courses.facade';
import {LibraryApiService} from '../../core/library/library-api.service';
import type {CollectionLearningPathView} from '../../domain/collection-learning-path/learning-path';
import type {LibraryCollection} from '../../domain/learning/models';
import {LibraryPageComponent} from './library-page.component';

@Component({
  standalone: true,
  template: '',
})
class EmptyLibraryDetailComponent {}

function collection(
  id: string,
  title: string,
  subscribed: boolean,
): LibraryCollection {
  return {
    id,
    slug: id,
    title,
    kind: 'book',
    visibility: 'public',
    status: 'published',
    contentVersion: 1,
    wordCount: 10,
    subscribed,
  };
}

function courseView(
  item: LibraryCollection,
  learnerStatus: 'available' | 'in_progress',
  title = item.title,
): CollectionLearningPathView {
  return {
    access: {canProgress: item.subscribed},
    resumePoint: null,
    path: {
      id: `${item.id}-path`,
      collectionId: item.id,
      title,
      mode: 'finite',
      status: 'published',
      contentVersion: '1',
      learnerStatus,
      progress: null,
    },
    lessons: [],
  };
}

describe('LibraryPageComponent', () => {
  const alphaCourse = collection('alpha-course', 'Alpha Course Vocabulary', true);
  const betaCollection = collection('beta-collection', 'Beta Collection', true);
  const charlieCourse = collection('charlie-course', 'Charlie Course Vocabulary', false);
  const deltaCollection = collection('delta-collection', 'Delta Collection', false);
  const zetaCourse = collection('zeta-course', 'Zeta Vocabulary Collection', true);
  const all = [zetaCourse, deltaCollection, charlieCourse, betaCollection, alphaCourse];
  const views = new Map([
    [alphaCourse.id, courseView(alphaCourse, 'available', 'Alpha Course')],
    [charlieCourse.id, courseView(charlieCourse, 'available', 'Charlie Course')],
    [zetaCourse.id, courseView(zetaCourse, 'in_progress', 'Zeta Course')],
  ]);
  const summaries = new Map(Array.from(views.entries()).map(([id, view]) => [id, {
    collectionId: id,
    pathId: view.path.id,
    title: view.path.title,
    learnerStatus: view.path.learnerStatus,
    enrolled: view.path.learnerStatus !== 'available',
  }]));
  const list = vi.fn();
  const loadCatalog = vi.fn(async () => true);
  const journeyError = signal('');

  beforeEach(async () => {
    vi.clearAllMocks();
    journeyError.set('');
    loadCatalog.mockResolvedValue(true);
    list.mockResolvedValue({collections: all, capabilities: {canManage: false}});
    await TestBed.configureTestingModule({
      imports: [LibraryPageComponent],
      providers: [
        provideRouter([{path: 'library/:id', component: EmptyLibraryDetailComponent}]),
        {provide: LibraryApiService, useValue: {list}},
        {
          provide: LibraryLearningPathJourneyFacade,
          useValue: {
            loading: signal(false),
            enteringId: signal<string | null>(null),
            error: journeyError,
            loadCatalog,
            courseSummaryFor: (id: string) => summaries.get(id) ?? null,
          },
        },
        {provide: SelectedCoursesFacade, useValue: {load: vi.fn(async () => true)}},
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(LibraryPageComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    return fixture;
  }

  function itemNames(host: HTMLElement, section: string): string[] {
    return Array.from(host.querySelectorAll(`[data-testid="${section}"] [data-testid="library-item"]`))
      .map((item) => item.textContent?.trim() ?? '');
  }

  it('renders exactly three alphabetical name-only sections with independent course and collection state', async () => {
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelectorAll('[data-testid="library-section"]')).toHaveLength(3);
    expect(itemNames(host, 'library-my-items')).toEqual([
      'Alpha Course Vocabulary',
      'Beta Collection',
      'Zeta Course',
    ]);
    expect(Array.from(host.querySelectorAll('[data-testid="library-my-items"] [data-testid="library-item"]'))
      .map((item) => item.getAttribute('data-library-kind'))).toEqual(['collection', 'collection', 'course']);
    expect(itemNames(host, 'library-all-courses')).toEqual([
      'Alpha Course',
      'Charlie Course',
      'Zeta Course',
    ]);
    expect(itemNames(host, 'library-all-collections')).toEqual([
      'Alpha Course Vocabulary',
      'Beta Collection',
      'Charlie Course Vocabulary',
      'Delta Collection',
      'Zeta Vocabulary Collection',
    ]);
    expect(host.querySelector('input, mat-select, mat-progress-bar')).toBeNull();
  });

  it('drops a removed Leitner collection from My Courses and Collections after reload', async () => {
    const fixture = await render();
    list.mockResolvedValueOnce({
      collections: all.map((item) => item.id === betaCollection.id ? {...item, subscribed: false} : item),
      capabilities: {canManage: false},
    });

    await fixture.componentInstance.load();
    fixture.detectChanges();

    expect(itemNames(fixture.nativeElement, 'library-my-items')).toEqual([
      'Alpha Course Vocabulary',
      'Zeta Course',
    ]);
  });

  it('keeps an enrolled course after its vocabulary is removed from Leitner', async () => {
    const fixture = await render();
    list.mockResolvedValueOnce({
      collections: all.map((item) => item.id === zetaCourse.id ? {...item, subscribed: false} : item),
      capabilities: {canManage: false},
    });

    await fixture.componentInstance.load();
    fixture.detectChanges();

    expect(itemNames(fixture.nativeElement, 'library-my-items')).toEqual([
      'Alpha Course Vocabulary',
      'Beta Collection',
      'Zeta Course',
    ]);
  });

  it('renders course and collection navigation as real detail-route anchors', async () => {
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    const item = host.querySelector<HTMLElement>(
      '[data-testid="library-all-courses"] [data-testid="library-item"]',
    );
    const anchor = item?.querySelector('a');

    expect(item?.localName).toBe('voco-secondary-link');
    expect(anchor?.getAttribute('href')).toBe(`/library/${alphaCourse.id}`);
  });

  it('shows a retry action when known courses fail to load', async () => {
    journeyError.set('Some courses could not load. Open a course to try again.');
    loadCatalog.mockResolvedValue(false);
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Some courses could not load');
    host.querySelector<HTMLElement>('[data-testid="course-load-retry"]')?.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();

    expect(loadCatalog).toHaveBeenCalledTimes(3);
  });
});
