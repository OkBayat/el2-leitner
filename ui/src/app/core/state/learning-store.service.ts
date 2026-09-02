import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogService } from '../catalog/catalog.service';
import { ApiClientService, ApiError } from '../http/api-client.service';
import { VocabularyApiService } from '../learning/vocabulary-api.service';
import { activateUnseenWords, createFreshState, ensureDailyWords, hydrateState, localDay } from '../../domain/learning/learning-rules';
import { LearningState, LearningStateResponse, LearningWord } from '../../domain/learning/models';

const LEGACY_STORAGE_KEY = 'vazheyar-ielts-state-v1';
const EDITABLE_WORD_KEYS = new Set<keyof LearningWord>(['term', 'accepted', 'category', 'notes']);

export interface VocabularyEditCandidate {
  index: number;
  word: LearningWord;
}

function stableWord(word: LearningWord): Record<string, unknown> {
  return Object.fromEntries(Object.entries(word).filter(([key]) => !EDITABLE_WORD_KEYS.has(key as keyof LearningWord)));
}

export function detectSingleVocabularyEdit(before: LearningState, after: LearningState): VocabularyEditCandidate | null {
  if (before.words.length !== after.words.length) return null;
  const beforeRoot = { ...before, words: [], updatedAt: '' };
  const afterRoot = { ...after, words: [], updatedAt: '' };
  if (JSON.stringify(beforeRoot) !== JSON.stringify(afterRoot)) return null;

  const changed: number[] = [];
  for (let index = 0; index < before.words.length; index += 1) {
    if (JSON.stringify(before.words[index]) !== JSON.stringify(after.words[index])) changed.push(index);
  }
  if (changed.length !== 1) return null;

  const index = changed[0];
  const previous = before.words[index];
  const next = after.words[index];
  if (previous.id !== next.id || JSON.stringify(stableWord(previous)) !== JSON.stringify(stableWord(next))) return null;
  return { index, word: next };
}

@Injectable({ providedIn: 'root' })
export class LearningStoreService {
  private readonly api = inject(ApiClientService);
  private readonly catalog = inject(CatalogService);
  private readonly vocabularyApi = inject(VocabularyApiService);
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

  initialize(): Promise<LearningState> { this.initializePromise ??= this.load(); return this.initializePromise; }

  private async load(): Promise<LearningState> {
    this.loadingSignal.set(true);
    try {
      const response = await this.api.get<LearningStateResponse>('/api/state');
      this.acceptRevision(response.revision, { minimum: 0 });
      let state: LearningState;
      if (response.state) {
        state = hydrateState(response.state);
      } else {
        const initial = await this.loadInitialState();
        await this.persistState(initial.state);
        state = await this.reloadCanonicalBootstrap();
        if (initial.legacyMigrated) {
          try { globalThis.localStorage?.removeItem(LEGACY_STORAGE_KEY); } catch { /* uploaded and canonicalized safely */ }
        }
      }

      const daily = ensureDailyWords(state, localDay());
      state = daily.state;
      if (daily.activated.length) {
        const revision = await this.vocabularyApi.activateBatch(this.revisionSignal(), daily.activated.map((word) => word.id), localDay(), 'daily');
        this.revisionSignal.set(revision);
      }
      this.stateSignal.set(state);
      return state;
    } finally { this.loadingSignal.set(false); }
  }

  private async reloadCanonicalBootstrap(): Promise<LearningState> {
    const response = await this.api.get<LearningStateResponse>('/api/state?view=bootstrap');
    const currentRevision = this.revisionSignal();
    this.acceptRevision(response.revision, { minimum: currentRevision, maximum: currentRevision });
    if (!response.state) {
      throw new ApiError('Canonical data is not available after saving.', 502, 'INVALID_BOOTSTRAP_STATE');
    }
    return hydrateState(response.state);
  }

  private acceptRevision(value: number, range: { minimum: number; maximum?: number }): void {
    const revision = Number(value);
    if (!Number.isSafeInteger(revision) || revision < range.minimum || (range.maximum !== undefined && revision > range.maximum)) {
      throw new ApiError('The received state revision is invalid.', 502, 'INVALID_STATE_REVISION');
    }
    this.revisionSignal.set(revision);
  }

  private async loadInitialState(): Promise<{ state: LearningState; legacyMigrated: boolean }> {
    try { const raw = globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY); if (raw) return { state: hydrateState(JSON.parse(raw) as LearningState), legacyMigrated: true }; } catch { /* fallback */ }
    return { state: createFreshState(await this.catalog.loadCoreVocabulary()), legacyMigrated: false };
  }

  snapshot(): LearningState { const state = this.stateSignal(); if (!state) throw new Error('Learning state is not initialized.'); return structuredClone(state); }
  replaceLocal(state: LearningState, revision = this.revisionSignal()): void { this.stateSignal.set(structuredClone(state)); this.revisionSignal.set(revision); }
  acknowledgeRevision(revision: number): void { if (!Number.isSafeInteger(revision) || revision <= this.revisionSignal()) throw new Error('Invalid acknowledged revision.'); this.revisionSignal.set(revision); }

  async activateWord(word: LearningWord): Promise<LearningState> {
    const day = localDay(); const result = activateUnseenWords(this.snapshot(), [word], 'word-bank', day);
    if (!result.activated.length) return this.snapshot();
    const revision = await this.vocabularyApi.activate(this.revisionSignal(), word.id, day);
    this.replaceLocal(result.state, revision); return result.state;
  }

  async activateWords(words: LearningWord[], source: 'daily' | 'home-selection'): Promise<{ state: LearningState; activated: LearningWord[] }> {
    const day = localDay(); const result = activateUnseenWords(this.snapshot(), words, source, day);
    if (!result.activated.length) return result;
    const revision = await this.vocabularyApi.activateBatch(this.revisionSignal(), result.activated.map((word) => word.id), day, source);
    this.replaceLocal(result.state, revision); return result;
  }

  async update(mutator: (state: LearningState) => void): Promise<LearningState> {
    const before = this.snapshot();
    const state = structuredClone(before);
    mutator(state);
    state.updatedAt = new Date().toISOString();
    const vocabularyEdit = detectSingleVocabularyEdit(before, state);
    if (vocabularyEdit) {
      await this.persistVocabularyEdit(state, vocabularyEdit);
      return state;
    }
    await this.persistState(state);
    this.stateSignal.set(state);
    return state;
  }

  async replaceAndPersist(state: LearningState): Promise<void> { await this.persistState(state); this.stateSignal.set(structuredClone(state)); }
  async persistCurrent(): Promise<void> { await this.persistState(this.snapshot()); }

  private async persistVocabularyEdit(state: LearningState, edit: VocabularyEditCandidate): Promise<void> {
    if (this.writeBlockedSignal()) throw new ApiError('Saving is blocked because the state revision conflicts with a newer version.', 409, 'STATE_CONFLICT');
    try {
      const result = await this.vocabularyApi.update(this.revisionSignal(), edit.word.id, {
        term: edit.word.term,
        acceptedForms: edit.word.accepted,
        category: edit.word.category,
        notes: edit.word.notes,
      });
      state.words[edit.index] = { ...state.words[edit.index], ...result.word };
      this.replaceLocal(state, result.revision);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'STATE_CONFLICT') this.writeBlockedSignal.set(true);
      throw error;
    }
  }

  private async persistState(state: LearningState): Promise<void> {
    if (this.writeBlockedSignal()) throw new ApiError('Saving is blocked because the state revision conflicts with a newer version.', 409, 'STATE_CONFLICT');
    try {
      const response = await this.api.put<{ revision: number }>('/api/state', { state, revision: this.revisionSignal() });
      const next = Number(response.revision);
      if (!Number.isSafeInteger(next) || next <= this.revisionSignal()) throw new ApiError('The saved state revision is invalid.', 502, 'INVALID_STATE_REVISION');
      this.revisionSignal.set(next);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'STATE_CONFLICT') this.writeBlockedSignal.set(true);
      throw error;
    }
  }
}
