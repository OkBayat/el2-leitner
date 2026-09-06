import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientService } from '../http/api-client.service';
import { CollectionLearningPathApiService } from './collection-learning-path-api.service';

describe('CollectionLearningPathApiService', () => {
  const get = vi.fn();
  const post = vi.fn();
  let api: CollectionLearningPathApiService;

  beforeEach(() => {
    get.mockReset(); post.mockReset();
    get.mockResolvedValue({}); post.mockResolvedValue({});
    TestBed.configureTestingModule({ providers: [CollectionLearningPathApiService, { provide: ApiClientService, useValue: { get, post } }] });
    api = TestBed.inject(CollectionLearningPathApiService);
  });

  it('keeps read operations on query endpoints', async () => {
    await api.queryCollectionLearningPath('collection/1');
    await api.queryResumePoint('path/1');
    await api.queryExerciseContext('path/1', 'lesson/1', 'exercise/1');
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/api/learning-paths/collections/collection%2F1',
      '/api/learning-paths/path%2F1/resume',
      '/api/learning-paths/path%2F1/lessons/lesson%2F1/exercises/exercise%2F1',
    ]);
  });

  it('keeps mutations on explicit command endpoints', async () => {
    await api.commandStartPath('path/1');
    await api.commandStartExercise('path/1', 'lesson/1', 'exercise/1');
    expect(post.mock.calls.map(([path]) => path)).toEqual([
      '/api/learning-paths/path%2F1/start',
      '/api/learning-paths/path%2F1/lessons/lesson%2F1/exercises/exercise%2F1/start',
    ]);
  });
});
