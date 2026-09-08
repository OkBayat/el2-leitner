import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {LibraryLearningPathJourneyFacade} from '../../application/collection-learning-path/library-learning-path-journey.facade';
import {SelectedCoursesFacade} from '../../application/collection-learning-path/selected-courses.facade';
import {LibraryApiService} from '../../core/library/library-api.service';
import type {CollectionLearningPathView} from '../../domain/collection-learning-path/learning-path';
import type {LibraryCollection} from '../../domain/learning/models';
import {LibraryPageComponent} from './library-page.component';

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
  const list = vi.fn();
  const navigate = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    list.mockResolvedValue({collections: all, capabilities: {canManage: false}});
    await TestBed.configureTestingModule({
      imports: [LibraryPageComponent],
      providers: [
        {provide: Router, useValue: {navigate}},
        {provide: LibraryApiService, useValue: {list}},
        {
          provide: LibraryLearningPathJourneyFacade,
          useValue: {
            loading: signal(false),
            enteringId: signal<string | null>(null),
            error: signal(''),
            load: vi.fn(async () => true),
            viewFor: (id: string) => views.get(id) ?? null,
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

  it('opens course and collection items in the existing detail route', async () => {
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    const item = host.querySelector<HTMLButtonElement>(
      '[data-testid="library-all-courses"] [data-testid="library-item"]',
    );

    item?.click();

    expect(navigate).toHaveBeenCalledWith(['/library', alphaCourse.id]);
  });
});
