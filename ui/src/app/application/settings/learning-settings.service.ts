import { Injectable, inject } from '@angular/core';
import { ApiClientService, ApiError } from '../../core/http/api-client.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { LearningSettings, LearningState } from '../../domain/learning/models';

interface LearningSettingsResponse {
  settings: LearningSettings;
  revision: number;
}

function sameSettings(left: LearningSettings, right: LearningSettings): boolean {
  return left.dailyNew === right.dailyNew
    && left.dailyGoal === right.dailyGoal
    && (left.dailyListeningGoal ?? 3) === (right.dailyListeningGoal ?? 3)
    && left.voiceRate === right.voiceRate
    && left.theme === right.theme;
}

@Injectable({ providedIn: 'root' })
export class LearningSettingsService {
  private readonly api = inject(ApiClientService);
  private readonly store = inject(LearningStoreService);

  async save(settings: LearningSettings): Promise<LearningState> {
    if (!this.store.ready()) await this.store.initialize();
    const revision = this.store.revision();
    const response = await this.api.put<LearningSettingsResponse>('/api/settings', {
      settings,
      revision,
    });
    const nextRevision = Number(response.revision);
    if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision || !sameSettings(response.settings, settings)) {
      throw new ApiError('The saved settings response is invalid.', 502, 'INVALID_SETTINGS_RESPONSE');
    }

    const state = this.store.snapshot();
    state.settings = { ...response.settings };
    state.updatedAt = new Date().toISOString();
    this.store.replaceLocal(state, nextRevision);
    return state;
  }
}
