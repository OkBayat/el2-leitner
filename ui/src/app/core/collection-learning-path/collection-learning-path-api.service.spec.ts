import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientService } from '../http/api-client.service';
import { CollectionLearningPathApiService } from './collection-learning-path-api.service';

describe('CollectionLearningPathApiService', () => {
  const get = vi.fn();
  const post = vi.fn();
  const remove = vi.fn();
  let api: CollectionLearningPathApiService;

  beforeEach(() => {
    get.mockReset(); post.mockReset(); remove.mockReset();
    get.mockResolvedValue({ context: {} }); post.mockResolvedValue({}); remove.mockResolvedValue({});
    TestBed.configureTestingModule({
      providers: [CollectionLearningPathApiService, { provide: ApiClientService, useValue: { get, post, delete: remove } }],
    });
    api = TestBed.inject(CollectionLearningPathApiService);
  });

  it('keeps read operations on query endpoints', async () => {
    await api.queryLearningPathCollectionIds();
    await api.queryCollectionLearningPath('collection/1');
    await api.queryLearningPath('1');
    await api.queryResumePoint('1');
    await api.queryExerciseContext('1', '5', '10');
    await api.resolveLegacyExerciseRoute('path/1', 'lesson/1', 'exercise/1');
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/api/learning-paths/collections',
      '/api/learning-paths/collections/collection%2F1',
      '/api/learning-paths/1',
      '/api/learning-paths/1/resume',
      '/api/learning-paths/1/lessons/5/exercises/10',
      '/api/learning-paths/legacy/path%2F1/lessons/lesson%2F1/exercises/exercise%2F1/route',
    ]);
  });

  it('keeps generic and type-specific mutations on explicit command endpoints with progress revisions', async () => {
    await api.commandStartPath('1');
    await api.commandRemovePathEnrollment('1');
    await api.commandStartExercise('1', '5', '10', 7);
    await api.commandActivateVocabularyIntake('1', '5', '10');
    await api.commandStartVocabularySpelling('1', '5', '10', 'course');
    const recording = new Blob(['recording'], { type: 'audio/webm' });
    await api.commandUploadSlideSequenceRecording('1', '5', '10', 'speaking/1', recording);
    await api.commandCompleteExercise('1', '5', '10', { kind: 'completed' }, 8);

    expect(post.mock.calls.map(([path]) => path)).toEqual([
      '/api/learning-paths/1/start',
      '/api/learning-paths/1/lessons/5/exercises/10/start',
      '/api/learning-paths/1/lessons/5/exercises/10/vocabulary-intake/activate',
      '/api/learning-paths/1/lessons/5/exercises/10/vocabulary-spelling/start',
      '/api/learning-paths/1/lessons/5/exercises/10/slides/speaking%2F1/recordings',
      '/api/learning-paths/1/lessons/5/exercises/10/complete',
    ]);
    expect(remove).toHaveBeenCalledWith('/api/learning-paths/1/enrollment');
    expect(post.mock.calls[1]?.[1]).toEqual({ progressRevision: 7 });
    expect(post.mock.calls[3]?.[1]).toEqual({ scope: 'course' });
    expect(post.mock.calls[4]).toEqual([
      '/api/learning-paths/1/lessons/5/exercises/10/slides/speaking%2F1/recordings',
      recording,
      { 'Content-Type': 'audio/webm' },
    ]);
    expect(post.mock.calls.at(-1)?.[1]).toEqual({ outcome: { kind: 'completed' }, progressRevision: 8 });
  });
});
