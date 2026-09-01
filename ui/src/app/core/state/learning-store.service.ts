import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogService } from '../catalog/catalog.service';
import { ApiClientService, ApiError } from '../http/api-client.service';
import {
  createFreshState, ensureDailyWords, hydrateState, localDay,
} from '../../domain/learning/learning-rules';
import { LearningState, LearningStateResponse } from '../../domain/learning/models';

const LEGACY_STORAGE_KEY = 'vazheyar-ielts-state-v1';

@Injectable({ providedIn: 'root' })
export class LearningStoreService {
  private readonly api = inject(ApiClientService);
  private readonly catalog = inject(CatalogService);
  private readonly stateSignal = signal<LearningState | null>(null);
  private readonly revisionSignal = signal(0);
  private readonly loadingSignal = signal(false);
  private readonly writeBlockedSignal = signal(false);
  private initializePromise: Promise<LearningState> | null = null;

  readonly state = this.stateSignal.asReadonly();
  readonly revision = this.revisionSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly writeBlocked = this.writeBlockedSignal.asReadonly();
  readonly ready = computed(() => Boolean(this.stateSignal()));

  initialize(): Promise<LearningState> {
    this.initializePromise ??= this.load();
    return this.initializePromise;
  }

  private async load(): Promise<LearningState> {
    this.loadingSignal.set(true);
    try {
      const response = await this.api.get<LearningStateResponse>('/api/state');
      if (!Number.isSafeInteger(response.revision) || response.revision < 0) throw new ApiError('نسخهٔ دادهٔ دریافتی معتبر نیست.', 502, 'INVALID_STATE_REVISION');
      this.revisionSignal.set(response.revision);
      let state: LearningState;
      if (response.state) {
        state = hydrateState(response.state);
      } else {
        state = await this.loadInitialState();
        await this.persistState(state);
      }
      const daily = ensureDailyWords(state, localDay());
      state = daily.state;
      this.stateSignal.set(state);
      if (daily.activated.length) await this.persistState(state);
      return state;
    } finally { this.loadingSignal.set(false); }
  }

  private async loadInitialState(): Promise<LearningState> {
    const storage = globalThis.localStorage;
    if (storage) {
      try {
        const raw = storage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          const state = hydrateState(JSON.parse(raw) as LearningState);
          storage.removeItem(LEGACY_STORAGE_KEY);
          return state;
        }
      } catch { /* Fresh state remains a safe fallback. */ }
    }
    return createFreshState(await this.catalog.loadCoreVocabulary());
  }

  snapshot(): LearningState {
    const state = this.stateSignal();
    if (!state) throw new Error('Learning state is not initialized.');
    return structuredClone(state);
  }

  replaceLocal(state: LearningState, revision = this.revisionSignal()): void {
    this.stateSignal.set(structuredClone(state));
    this.revisionSignal.set(revision);
  }

  acknowledgeRevision(revision: number): void {
    if (!Number.isSafeInteger(revision) || revision <= this.revisionSignal()) throw new Error('Invalid acknowledged revision.');
    this.revisionSignal.set(revision);
  }

  async update(mutator: (state: LearningState) => void): Promise<LearningState> {
    const state = this.snapshot();
    mutator(state);
    state.updatedAt = new Date().toISOString();
    await this.persistState(state);
    this.stateSignal.set(state);
    return state;
  }

  async replaceAndPersist(state: LearningState): Promise<void> {
    await this.persistState(state);
    this.stateSignal.set(structuredClone(state));
  }

  async persistCurrent(): Promise<void> { await this.persistState(this.snapshot()); }

  private async persistState(state: LearningState): Promise<void> {
    if (this.writeBlockedSignal()) throw new ApiError('ذخیره‌سازی به‌دلیل تعارض نسخه متوقف شده است.', 409, 'STATE_CONFLICT');
    try {
      const response = await this.api.put<{ revision: number; state?: LearningState }>('/api/state', {
        state,
        revision: this.revisionSignal(),
      });
      const nextRevision = Number(response.revision);
      if (!Number.isSafeInteger(nextRevision) || nextRevision <= this.revisionSignal()) throw new ApiError('نسخهٔ ذخیره‌شده معتبر نیست.', 502, 'INVALID_STATE_REVISION');
      this.revisionSignal.set(nextRevision);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'STATE_CONFLICT') this.writeBlockedSignal.set(true);
      throw error;
    }
  }
}
