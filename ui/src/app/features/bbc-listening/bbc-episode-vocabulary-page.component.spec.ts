import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningVocabularyService } from '../../application/listening-practice/listening-vocabulary.service';
import { SpeechService } from '../../core/speech/speech.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { createFreshState } from '../../domain/learning/learning-rules';
import { ListeningVocabularyResponse, listeningDifficultyLabel, listeningLevelLabel } from '../../domain/listening-practice/listening-practice';
import { BbcEpisodeVocabularyPageComponent } from './bbc-episode-vocabulary-page.component';

const data: ListeningVocabularyResponse = {
  episode: { id: 'episode-1', slug: 'screen-time', title: 'Screen time', level: 'intermediate' }, collectionId: 'episode-1', subscribed: false,
  entries: [
    { id: 'entry-1', vocabularyId: 'word-1', term: 'intentional', definitions: ['Done deliberately.'], examples: ['It was an intentional choice.'], progress: { state: 'new', box: 0 } },
    { id: 'entry-2', vocabularyId: 'word-2', term: 'eager', definitions: ['Very keen.'], examples: ['She was eager to help.'], progress: { state: 'mastered', box: 0 } },
    { id: 'entry-3', vocabularyId: 'word-3', term: 'shift', definitions: ['A change.'], examples: ['The shift was small.'], progress: { state: 'learning', box: 3 } },
  ],
};
async function setup() {
  const service = { load: vi.fn().mockResolvedValue(structuredClone(data)), add: vi.fn().mockResolvedValue({ added: 1, vocabulary: structuredClone(data) }) };
  const speech = { speak: vi.fn().mockReturnValue(true), cancel: vi.fn() };
  TestBed.configureTestingModule({ imports: [BbcEpisodeVocabularyPageComponent], providers: [provideRouter([]),
    { provide: ListeningVocabularyService, useValue: service }, { provide: SpeechService, useValue: speech },
    { provide: LearningStoreService, useValue: { state: signal(createFreshState([])) } },
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ lessonSlug: 'screen-time' })) } },
  ] });
  const fixture = TestBed.createComponent(BbcEpisodeVocabularyPageComponent);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  return { fixture, page: fixture.componentInstance, service, speech, element: fixture.nativeElement as HTMLElement };
}

describe('Episode vocabulary page', () => {
  beforeEach(() => TestBed.resetTestingModule());
  it('renders only episode vocabulary with definition, example, level and back navigation', async () => {
    const f = await setup();
    expect(f.service.load).toHaveBeenCalledWith('screen-time');
    expect(f.element.querySelectorAll('.vocabulary-card')).toHaveLength(3);
    expect(f.element.textContent).toContain('Done deliberately.');
    expect(f.element.textContent).toContain('It was an intentional choice.');
    expect(f.element.textContent).toContain('Intermediate');
    expect(f.element.querySelector('a')?.getAttribute('href')).toBe('/bbc-6-minute-english');
    expect(f.element.querySelector('[data-testid="add-episode-word-word-2"]')).toBeNull();
    expect(f.element.textContent).toContain('Mastered'); expect(f.element.textContent).toContain('In Leitner Box 3');
  });
  it('has independent add-all, add-one and pronunciation actions', async () => {
    const f = await setup();
    f.element.querySelector('[data-testid="pronounce-episode-word-word-1"]')?.querySelector<HTMLButtonElement>('button')?.click();
    expect(f.speech.speak).toHaveBeenCalledWith('intentional', 0.85);
    await f.page.add(data.entries[0]); expect(f.service.add).toHaveBeenCalledWith('screen-time', ['word-1']);
    await f.page.add(); expect(f.service.add).toHaveBeenCalledWith('screen-time', undefined);
    expect(f.page.message()).toContain('1 word added');
  });
  it('does not allow repeated clicks or adding mastered words', async () => {
    const f = await setup(); await f.page.add(data.entries[1]); expect(f.service.add).not.toHaveBeenCalled();
    f.page.saving.set(true); await f.page.add(); expect(f.service.add).not.toHaveBeenCalled();
  });
  it('shows recoverable loading and activation errors without losing the episode data', async () => {
    const f = await setup(); f.service.add.mockRejectedValueOnce(new Error('offline'));
    await f.page.add(); expect(f.page.error()).toBe('offline'); expect(f.page.vocabulary()?.episode.id).toBe('episode-1');
    expect(f.page.saving()).toBe(false);
    f.service.load.mockRejectedValueOnce(new Error('missing episode')); await f.page.load();
    expect(f.page.error()).toBe('missing episode'); expect(f.page.loading()).toBe(false);
  });
  it('supports all documented language levels and independent test difficulties', () => {
    expect(['elementary', 'intermediate', 'advanced'].map((level) => listeningLevelLabel(level as 'elementary'))).toEqual(['Elementary', 'Intermediate', 'Advanced']);
    expect(['very_easy', 'easy', 'medium', 'hard', 'very_hard'].map((level) => listeningDifficultyLabel(level as 'easy'))).toEqual(['Very easy', 'Easy', 'Medium', 'Hard', 'Very hard']);
  });
});
