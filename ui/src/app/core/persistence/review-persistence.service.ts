import { Injectable, inject } from '@angular/core';
import { ReviewCommand } from '../../domain/learning/models';
import { ApiClientService, ApiError } from '../http/api-client.service';

const RETRY_DELAYS_MS = [0, 150, 450, 900] as const;

@Injectable({ providedIn: 'root' })
export class ReviewPersistenceService {
  private readonly api = inject(ApiClientService);

  async persist(command: ReviewCommand): Promise<number> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const response = await this.api.post<{ revision: number }>('/api/learning/reviews', command);
        if (!Number.isSafeInteger(response.revision) || response.revision !== command.revision + 1) {
          throw new ApiError('The saved state revision returned by the server is invalid.', 502, 'INVALID_STATE_REVISION');
        }
        return response.revision;
      } catch (error) {
        lastError = error;
        const transient = error instanceof ApiError && (error.status === 0 || error.status === 408 || error.status === 425 || error.status >= 500);
        if (!transient || attempt === RETRY_DELAYS_MS.length - 1) throw error;
      }
    }
    throw lastError;
  }
}
