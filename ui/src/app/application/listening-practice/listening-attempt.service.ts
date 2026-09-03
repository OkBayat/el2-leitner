import { Injectable, inject, signal } from '@angular/core';
import { ListeningPracticeApiService } from '../../core/listening-practice/listening-practice-api.service';
import {
  ListeningAttempt,
  ListeningAttemptResult,
  ListeningLesson,
  buildListeningSubmission,
} from '../../domain/listening-practice/listening-practice';

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

@Injectable({ providedIn: 'root' })
export class ListeningAttemptService {
  private readonly api = inject(ListeningPracticeApiService);

  readonly lesson = signal<ListeningLesson | null>(null);
  readonly attempt = signal<ListeningAttempt | null>(null);
  readonly result = signal<ListeningAttemptResult | null>(null);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  async start(lessonSlug: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    this.lesson.set(null);
    this.attempt.set(null);
    this.result.set(null);
    try {
      const response = await this.api.startBbcAttempt(lessonSlug);
      this.lesson.set(response.lesson);
      this.attempt.set(response.attempt);
      return true;
    } catch (error) {
      this.error.set(message(error, 'The listening exercise could not be loaded.'));
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async submit(values: Record<string, string>): Promise<boolean> {
    const attempt = this.attempt();
    const lesson = this.lesson();
    if (!attempt || !lesson || this.result()) return false;

    this.submitting.set(true);
    this.error.set(null);
    try {
      const result = await this.api.submitBbcAttempt(
        attempt.id,
        buildListeningSubmission(lesson, values),
      );
      this.result.set(result);
      this.attempt.set(result.attempt);
      return true;
    } catch (error) {
      this.error.set(message(error, 'The listening answers could not be submitted.'));
      return false;
    } finally {
      this.submitting.set(false);
    }
  }
}
