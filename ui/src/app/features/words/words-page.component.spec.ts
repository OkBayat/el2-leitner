import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { createFreshState } from '../../domain/learning/learning-rules';
import { WordsPageComponent } from './words-page.component';

describe('WordsPageComponent', () => {
  const state = createFreshState(Array.from({ length: 41 }, (_, index) => ({
    id: `word-${index + 1}`,
    term: `word ${index + 1}`,
  })));
  const activateWord = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [WordsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: LearningStoreService,
          useValue: {
            state: signal(state),
            initialize: vi.fn().mockResolvedValue(state),
            activateWord,
            update: vi.fn(),
            replaceAndPersist: vi.fn(),
            snapshot: () => structuredClone(state),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('renders only Word and Box columns and adds an unintroduced word to Leitner', async () => {
    const fixture = TestBed.createComponent(WordsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect([...element.querySelectorAll('th')].map((cell) => cell.textContent?.trim())).toEqual(['Word', 'Box']);
    expect(element.textContent).not.toContain('Not introduced');
    expect(element.textContent).not.toContain('Previous');
    expect(element.textContent).not.toContain('Next');
    expect(element.querySelectorAll('.word-link')).toHaveLength(40);
    expect(getComputedStyle(element.querySelector<HTMLButtonElement>('.add-to-leitner')!).whiteSpace).toBe('nowrap');

    element.querySelector<HTMLButtonElement>('.add-to-leitner')?.click();
    await fixture.whenStable();
    expect(activateWord).toHaveBeenCalledWith(state.words[0]);
  });

  it('appends the next chunk when lazy loading reaches the sentinel', () => {
    const fixture = TestBed.createComponent(WordsPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.visibleWords()).toHaveLength(40);
    expect(fixture.componentInstance.hasMore()).toBe(true);
    fixture.componentInstance.loadMore();

    expect(fixture.componentInstance.visibleWords()).toHaveLength(41);
    expect(fixture.componentInstance.hasMore()).toBe(false);
  });
});
