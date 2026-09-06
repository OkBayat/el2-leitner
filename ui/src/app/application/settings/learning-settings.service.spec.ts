import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientService } from '../../core/http/api-client.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { createFreshState } from '../../domain/learning/learning-rules';
import { LearningSettingsService } from './learning-settings.service';

describe('LearningSettingsService', () => {
  it('sends only settings and revision, then advances the local canonical revision', async () => {
    const state = createFreshState([]);
    state.settings = {
      dailyNew: 10,
      dailyGoal: 20,
      dailyListeningGoal: 3,
      voiceRate: 0.85,
      theme: 'light',
    };
    const nextSettings = { ...state.settings, dailyListeningGoal: 4 };
    const api = {
      put: vi.fn().mockResolvedValue({ settings: nextSettings, revision: 12 }),
    };
    const store = {
      ready: vi.fn(() => true),
      initialize: vi.fn(),
      revision: vi.fn(() => 11),
      snapshot: vi.fn(() => structuredClone(state)),
      replaceLocal: vi.fn(),
    };

    TestBed.configureTestingModule({ providers: [
      LearningSettingsService,
      { provide: ApiClientService, useValue: api },
      { provide: LearningStoreService, useValue: store },
    ] });

    const result = await TestBed.inject(LearningSettingsService).save(nextSettings);

    expect(api.put).toHaveBeenCalledWith('/api/settings', {
      settings: nextSettings,
      revision: 11,
    });
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('state');
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('words');
    expect(store.replaceLocal).toHaveBeenCalledWith(expect.objectContaining({ settings: nextSettings }), 12);
    expect(result.settings.dailyListeningGoal).toBe(4);
  });
});
