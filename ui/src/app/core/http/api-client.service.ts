import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export class ApiError extends Error {
  constructor(message: string, readonly status = 0, readonly code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);

  async get<T>(path: string): Promise<T> { return this.request<T>('GET', path); }
  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> { return this.request<T>('POST', path, body, headers); }
  async put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> { return this.request<T>('PUT', path, body, headers); }
  async delete<T>(path: string): Promise<T> { return this.request<T>('DELETE', path); }

  private async request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, path, {
        body,
        headers: new HttpHeaders(headers || {}),
        withCredentials: true,
      }));
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const payload = error.error as { error?: { code?: string; message?: string }; message?: string } | null;
        throw new ApiError(payload?.error?.message || payload?.message || error.message || 'Request failed.', error.status, payload?.error?.code || 'API_ERROR');
      }
      throw error;
    }
  }
}
