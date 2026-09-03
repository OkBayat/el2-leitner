import { Injectable, inject } from '@angular/core';
import {
  ListeningAttemptResult,
  ListeningAttemptStartResponse,
  ListeningLessonListResponse,
  ListeningSubmittedAnswer,
} from '../../domain/listening-practice/listening-practice';
import { ApiClientService } from '../http/api-client.service';

@Injectable({ providedIn: 'root' })
export class ListeningPracticeApiService {
  private readonly api = inject(ApiClientService);

  listBbcLessons(): Promise<ListeningLessonListResponse> {
    return this.api.get('/api/listening/bbc/lessons');
  }

  startBbcAttempt(lessonSlug: string): Promise<ListeningAttemptStartResponse> {
    return this.api.post(
      `/api/listening/bbc/lessons/${encodeURIComponent(lessonSlug)}/attempts`,
    );
  }

  submitBbcAttempt(attemptId: string, answers: ListeningSubmittedAnswer[]): Promise<ListeningAttemptResult> {
    return this.api.post(
      `/api/listening/bbc/attempts/${encodeURIComponent(attemptId)}/submit`,
      { answers },
    );
  }
}
