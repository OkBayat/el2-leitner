import { Injectable, inject } from '@angular/core';
import { LibraryCollection } from '../../domain/learning/models';
import { ApiClientService } from '../http/api-client.service';

export interface LibraryListResponse { collections: LibraryCollection[]; capabilities?: { canManage?: boolean } }
export interface LibraryDetailResponse { collection: LibraryCollection; capabilities?: { canManage?: boolean } }

@Injectable({ providedIn: 'root' })
export class LibraryApiService {
  private readonly api = inject(ApiClientService);
  list(): Promise<LibraryListResponse> { return this.api.get('/api/library'); }
  get(id: string): Promise<LibraryDetailResponse> { return this.api.get(`/api/library/${encodeURIComponent(id)}`); }
  create(input: Record<string, unknown>): Promise<LibraryDetailResponse> { return this.api.post('/api/library', input); }
  update(id: string, input: Record<string, unknown>): Promise<LibraryDetailResponse> { return this.api.put(`/api/library/${encodeURIComponent(id)}`, input); }
  subscribe(id: string): Promise<LibraryDetailResponse> { return this.api.post(`/api/library/${encodeURIComponent(id)}/subscription`); }
  unsubscribe(id: string): Promise<LibraryDetailResponse> { return this.api.delete(`/api/library/${encodeURIComponent(id)}/subscription`); }
  import(id: string, text: string, mode: 'replace' | 'append'): Promise<unknown> { return this.api.post(`/api/library/${encodeURIComponent(id)}/import`, { text, mode }); }
  addEntry(id: string, input: Record<string, unknown>): Promise<unknown> { return this.api.post(`/api/library/${encodeURIComponent(id)}/entries`, input); }
  updateEntry(id: string, entryId: string, input: Record<string, unknown>): Promise<unknown> { return this.api.put(`/api/library/${encodeURIComponent(id)}/entries/${encodeURIComponent(entryId)}`, input); }
  removeEntry(id: string, entryId: string): Promise<unknown> { return this.api.delete(`/api/library/${encodeURIComponent(id)}/entries/${encodeURIComponent(entryId)}`); }
}
