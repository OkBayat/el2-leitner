import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CollectionLearningPathApiService } from '../../../core/collection-learning-path/collection-learning-path-api.service';
import type { CollectionLearningPathView } from '../../../domain/collection-learning-path/learning-path';
import { LessonPodcastPageComponent } from './lesson-podcast-page.component';

const view: CollectionLearningPathView = {
  access: { canProgress: true },
  resumePoint: null,
  path: {
    id: '4',
    collectionId: 'grammar-for-ielts',
    title: 'Cambridge Grammar for IELTS',
    mode: 'finite',
    status: 'published',
    contentVersion: '1',
    learnerStatus: 'in_progress',
    progress: null,
  },
  lessons: [{
    id: '64',
    title: 'Unit 1 — Present tenses',
    position: 1,
    sourceKind: 'collection-section',
    sourceRef: '10',
    state: 'in_progress',
    progress: null,
    exercises: [],
  }],
};

describe('LessonPodcastPageComponent', () => {
  it('loads the canonical lesson, renders outside shell chrome, and plays its managed M4A file', async () => {
    const api = { queryLearningPath: vi.fn().mockResolvedValue(view) };
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [LessonPodcastPageComponent],
      providers: [
        provideRouter([]),
        { provide: CollectionLearningPathApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ pathId: '4', lessonId: '64' })) },
        },
      ],
    });

    const fixture = TestBed.createComponent(LessonPodcastPageComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(api.queryLearningPath).toHaveBeenCalled());
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(api.queryLearningPath).toHaveBeenCalledWith('4');
    expect(element.textContent).toContain('Unit 1 — Present tenses');
    expect(element.querySelector('app-app-shell')).toBeNull();
    expect(element.querySelector('.lesson-podcast-page__header h1')?.textContent).toContain('Unit 1 — Present tenses');
    expect(element.querySelector<HTMLAnchorElement>('[data-testid="lesson-podcast-back"]')?.getAttribute('href'))
      .toBe('/learning-paths/4');
    expect(element.querySelector('[data-testid="lesson-podcast-download"]')).toBeNull();
    expect(element.querySelector<HTMLAudioElement>('audio')?.getAttribute('src'))
      .toBe('/api/learning-paths/4/lessons/64/audio');
    expect(element.querySelector('[data-testid="listening-audio-player"]')?.classList)
      .toContain('audio-player--immersive');
    expect(element.querySelectorAll('[data-testid="audio-waveform"] path')).toHaveLength(3);
    expect(element.querySelector('[data-testid="audio-speed"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="audio-back-10"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="audio-forward-10"]')).not.toBeNull();

    element.querySelector<HTMLButtonElement>('[data-testid="audio-play"]')?.click();
    await fixture.whenStable();
    expect(play).toHaveBeenCalledTimes(1);
  });
});
