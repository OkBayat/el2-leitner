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
    get.mockResolvedValue({ context: {} }); post.mockResolvedValue({});
    TestBed.configureTestingModule({
      providers: [CollectionLearningPathApiService, { provide: ApiClientService, useValue: { get, post } }],
    });
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

  it('keeps generic and type-specific mutations on explicit command endpoints with progress revisions', async () => {
    await api.commandStartPath('path/1');
    await api.commandStartExercise('path/1', 'lesson/1', 'exercise/1', 7);
    await api.commandActivateVocabularyIntake('path/1', 'lesson/1', 'exercise/1');
    await api.commandStartVocabularySpelling('path/1', 'lesson/1', 'exercise/1', 'course');
    await api.commandCompleteExercise('path/1', 'lesson/1', 'exercise/1', { kind: 'completed' }, 8);

    expect(post.mock.calls.map(([path]) => path)).toEqual([
      '/api/learning-paths/path%2F1/start',
      '/api/learning-paths/path%2F1/lessons/lesson%2F1/exercises/exercise%2F1/start',
      '/api/learning-paths/path%2F1/lessons/lesson%2F1/exercises/exercise%2F1/vocabulary-intake/activate',
      '/api/learning-paths/path%2F1/lessons/lesson%2F1/exercises/exercise%2F1/vocabulary-spelling/start',
      '/api/learning-paths/path%2F1/lessons/lesson%2F1/exercises/exercise%2F1/complete',
    ]);
    expect(post.mock.calls[1]?.[1]).toEqual({ progressRevision: 7 });
    expect(post.mock.calls[3]?.[1]).toEqual({ scope: 'course' });
    expect(post.mock.calls.at(-1)?.[1]).toEqual({ outcome: { kind: 'completed' }, progressRevision: 8 });
  });
});
