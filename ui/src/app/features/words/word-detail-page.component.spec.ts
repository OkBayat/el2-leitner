import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryApiService } from '../../core/library/library-api.service';
import { VocabularyApiService } from '../../core/learning/vocabulary-api.service';
import { SpeechService } from '../../core/speech/speech.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { createFreshState } from '../../domain/learning/learning-rules';
import { WordDetailPageComponent } from './word-detail-page.component';

describe('WordDetailPageComponent', () => {
  const state = createFreshState([{ id: 'word-1', term: 'evidence' }]);
  Object.assign(state.words[0], {
    attempts: 7,
    correct: 5,
    mistakes: 2,
    currentStreak: 3,
    category: 'Academic',
    lessons: ['Unit 1'],
    notes: 'Information that supports a claim.',
  });
  const stateSignal = signal(state);
  const navigate = vi.fn();
  const excludeWord = vi.fn();
  const refreshAfterSubscriptionChange = vi.fn().mockResolvedValue(state);
  const list = vi.fn();
  const get = vi.fn();
  const updateEntry = vi.fn();
  const sources = vi.fn().mockResolvedValue([{
    vocabularyId: 'word-1',
    term: 'evidence',
    collections: [{ id: 'collection-1', title: 'IELTS Vocabulary' }],
  }]);

  beforeEach(async () => {
    vi.clearAllMocks();
    stateSignal.set(structuredClone(state));
    await TestBed.configureTestingModule({
      imports: [WordDetailPageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'word-1' } } } },
        { provide: Router, useValue: { navigate } },
        {
          provide: LearningStoreService,
          useValue: {
            state: stateSignal,
            initialize: vi.fn().mockResolvedValue(state),
            snapshot: () => structuredClone(stateSignal()),
            excludeWord,
            refreshAfterSubscriptionChange,
          },
        },
        { provide: VocabularyApiService, useValue: { sources } },
        {
          provide: LibraryApiService,
          useValue: {
            list,
            get,
            updateEntry,
            removeEntry: vi.fn(),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }) } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: SpeechService, useValue: { speak: vi.fn() } },
      ],
    }).compileComponents();
  });

  async function render(canManage: boolean) {
    list.mockResolvedValue({ collections: [], capabilities: { canManage } });
    const fixture = TestBed.createComponent(WordDetailPageComponent);
    fixture.detectChanges();
    await vi.waitFor(() => {
      expect(fixture.componentInstance.sources()).toHaveLength(1);
    });
    fixture.detectChanges();
    return fixture;
  }

  it('shows practice details and collections while hiding management from learners', async () => {
    const fixture = await render(false);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('7');
    expect(element.textContent).toContain('Attempts');
    expect(element.textContent).toContain('2');
    expect(element.textContent).toContain('Mistakes');
    expect(element.textContent).toContain('IELTS Vocabulary');
    expect(element.textContent).toContain('Information that supports a claim.');
    expect(element.querySelector('.management-actions')).toBeNull();
    expect(element.textContent).toContain('Remove from my Word Bank');
  });

  it('shows collection edit and delete actions only to library managers', async () => {
    const fixture = await render(true);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.management-actions')?.textContent).toContain('Edit');
    expect(element.querySelector('.management-actions')?.textContent).toContain('Delete');
  });

  it('reconciles a newer canonical revision after a manager edits a collection entry', async () => {
    get.mockResolvedValue({
      collection: { entries: [{ id: 'entry-1', vocabularyId: 'word-1' }] },
    });
    const fixture = await render(true);

    await fixture.componentInstance.editSource(fixture.componentInstance.sources()[0]);

    expect(updateEntry).toHaveBeenCalledWith('collection-1', 'entry-1', true);
    expect(refreshAfterSubscriptionChange).toHaveBeenCalledOnce();
  });

  it('removes an eligible word from only the current learner Word Bank', async () => {
    const fixture = await render(false);

    await fixture.componentInstance.removeFromWordBank();

    expect(excludeWord).toHaveBeenCalledWith(stateSignal().words[0]);
    expect(navigate).toHaveBeenCalledWith(['/words']);
  });

  it('does not offer personal removal after a word enters Leitner', async () => {
    stateSignal.update((current) => ({
      ...current,
      words: current.words.map((word) => ({
        ...word,
        box: 1,
        introducedOn: '2026-09-09',
      })),
    }));
    const fixture = await render(false);

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Remove from my Word Bank');
  });
});
