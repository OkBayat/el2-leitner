import { Injectable, inject } from '@angular/core';
import { ApiClientService } from '../http/api-client.service';

export interface VocabularySourceInfo {
  vocabularyId: string;
  term: string;
  collections: Array<{ id: string; title: string }>;
}

export interface VocabularyEditInput {
  term: string;
  acceptedForms: string[];
  category: string;
  notes: string;
}

export interface VocabularyEditResult {
  revision: number;
  word: {
    id: string;
    term: string;
    accepted: string[];
    category: string;
    notes: string;
  };
}

@Injectable({ providedIn: 'root' })
export class VocabularyApiService {
  private readonly api = inject(ApiClientService);

  async activate(revision: number, vocabularyId: string, day: string): Promise<number> {
    const response = await this.api.post<{ revision: number }>('/api/learning/vocabulary-activations', { revision, vocabularyId, day });
    return this.requireNextRevision(response.revision, revision);
  }

  async activateBatch(revision: number, vocabularyIds: string[], day: string, source: 'daily' | 'home-selection'): Promise<number> {
    const response = await this.api.post<{ revision: number }>('/api/learning/vocabulary-activation-batches', { revision, vocabularyIds, day, source });
    return this.requireNextRevision(response.revision, revision);
  }

  async update(revision: number, vocabularyId: string, input: VocabularyEditInput): Promise<VocabularyEditResult> {
    const response = await this.api.put<VocabularyEditResult>(
      `/api/learning/vocabulary/${encodeURIComponent(vocabularyId)}`,
      { revision, ...input },
    );
    this.requireNextRevision(response.revision, revision);
    return response;
  }

  async sources(ids: string[]): Promise<VocabularySourceInfo[]> {
    if (!ids.length) return [];
    const response = await this.api.get<{ sources: VocabularySourceInfo[] }>(`/api/library/vocabulary-sources?ids=${encodeURIComponent(ids.slice(0, 50).join(','))}`);
    return response.sources || [];
  }

  private requireNextRevision(next: number, current: number): number {
    if (!Number.isSafeInteger(next) || next !== current + 1) throw new Error('Invalid vocabulary revision.');
    return next;
  }
}
