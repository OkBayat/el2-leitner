import { Injectable, inject } from '@angular/core';
import { ApiClientService } from '../http/api-client.service';

@Injectable({ providedIn: 'root' })
export class LearningApiService {
  private readonly api = inject(ApiClientService);

  startSession(mode: string, plannedCount: number): Promise<{ session: { id: string } }> {
    return this.api.post('/api/learning/sessions', { mode, plannedCount });
  }

  completeSession(sessionId: string, data: { completedCount: number; correctCount: number; wrongCount: number; durationSeconds: number }): Promise<unknown> {
    return this.api.put(`/api/learning/sessions/${encodeURIComponent(sessionId)}/complete`, data);
  }

  abandonSession(sessionId: string, durationSeconds: number): Promise<unknown> {
    return this.api.post(`/api/learning/sessions/${encodeURIComponent(sessionId)}/abandon`, { durationSeconds });
  }

  getHouse<T>(house: number): Promise<T> {
    return this.api.get<T>(`/api/learning/boxes/${house}`);
  }
}
