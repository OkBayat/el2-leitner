import { Injectable, inject } from '@angular/core';
import { ApiClientService } from '../http/api-client.service';
import { ShadowingAssessment, ShadowingDeck, ShadowingResult } from '../../domain/shadowing-practice/shadowing';

@Injectable({ providedIn: 'root' })
export class ShadowingApiService {
  private readonly api = inject(ApiClientService);
  private session(id: string): string { return `/api/shadowing/sessions/${encodeURIComponent(id)}`; }
  private recording(id: string, recordingId: string): string { return `${this.session(id)}/recordings/${encodeURIComponent(recordingId)}`; }
  start(): Promise<ShadowingDeck> { return this.api.post('/api/shadowing/sessions'); }
  record(id: string, wordId: string, sentenceId: string, day: string): Promise<{ recordingId: string }> {
    return this.api.post(`${this.session(id)}/recordings`, { wordId, sentenceId, day });
  }
  chunk(id: string, recordingId: string, sequence: number, pcm: ArrayBuffer): Promise<ShadowingAssessment> {
    return this.api.post(`${this.recording(id, recordingId)}/chunks?sequence=${sequence}`, pcm, { 'Content-Type': 'application/octet-stream' });
  }
  finish(id: string, recordingId: string): Promise<ShadowingResult> { return this.api.post(`${this.recording(id, recordingId)}/finish`); }
  cancel(id: string, recordingId: string): Promise<void> { return this.api.delete(this.recording(id, recordingId)); }
  close(id: string): Promise<void> { return this.api.delete(this.session(id)); }
}
