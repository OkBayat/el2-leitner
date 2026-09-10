import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LearningPathPodcastCatalogService } from './learning-path-podcast-catalog.service';

describe('LearningPathPodcastCatalogService', () => {
  it('resolves the managed lesson id from the build-time course catalog', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(LearningPathPodcastCatalogService);

    await expect(service.resolveLessonId('grammar-for-ielts', {
      position: 1,
      title: 'Unit 1 — Present tenses',
    })).resolves.toBe('gfi-unit-01');
    await expect(service.resolveLessonId('grammar-for-ielts', {
      position: 1,
      title: 'Unknown lesson',
    })).rejects.toThrow('The lesson audio mapping is not available.');
  });
});
