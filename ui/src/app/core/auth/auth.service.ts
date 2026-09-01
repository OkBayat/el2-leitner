import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiClientService, ApiError } from '../http/api-client.service';
import { User } from '../../domain/learning/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly userSignal = signal<User | null>(null);
  private currentRequest: Promise<User | null> | null = null;

  readonly user = this.userSignal.asReadonly();
  readonly authenticated = computed(() => Boolean(this.userSignal()));

  normalizeEmail(email: string): string { return String(email || '').trim().toLowerCase(); }

  validate(email: string, password: string, register = false): { email: string; password: string } {
    const normalized = this.normalizeEmail(email);
    if (!normalized || !password) throw new ApiError('ایمیل و رمز عبور را وارد کن.', 0, 'MISSING_CREDENTIALS');
    if (!/^[^\s@]+@[^\s@]+$/u.test(normalized)) throw new ApiError('یک ایمیل معتبر وارد کن.', 0, 'INVALID_EMAIL');
    const bytes = new TextEncoder().encode(password).length;
    if (bytes > 72) throw new ApiError(register ? 'رمز عبور نباید بیشتر از ۷۲ بایت باشد.' : 'ایمیل یا رمز عبور درست نیست.', 0, 'PASSWORD_TOO_LONG');
    if (register && password.length < 8) throw new ApiError('رمز عبور باید حداقل ۸ کاراکتر داشته باشد.', 0, 'INVALID_PASSWORD_LENGTH');
    return { email: normalized, password };
  }

  async login(email: string, password: string): Promise<User> {
    const credentials = this.validate(email, password, false);
    const response = await this.api.post<{ user: User }>('/api/auth/login', credentials);
    this.userSignal.set(response.user);
    return response.user;
  }

  async register(email: string, password: string): Promise<User> {
    const credentials = this.validate(email, password, true);
    const response = await this.api.post<{ user: User }>('/api/auth/register', credentials);
    this.userSignal.set(response.user);
    return response.user;
  }

  async currentUser(force = false): Promise<User | null> {
    if (!force && this.userSignal()) return this.userSignal();
    if (this.currentRequest) return this.currentRequest;
    this.currentRequest = this.api.get<{ user: User }>('/api/auth/me')
      .then((response) => { this.userSignal.set(response.user); return response.user; })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) { this.userSignal.set(null); return null; }
        throw error;
      })
      .finally(() => { this.currentRequest = null; });
    return this.currentRequest;
  }

  async logout(): Promise<void> {
    await this.api.post<unknown>('/api/auth/logout');
    this.userSignal.set(null);
    await this.router.navigateByUrl('/login');
  }

  safeReturnTo(value: string | null | undefined): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
    try {
      const url = new URL(value, globalThis.location?.origin || 'http://localhost');
      if (globalThis.location?.origin && url.origin !== globalThis.location.origin) return '/dashboard';
      return `${url.pathname}${url.search}${url.hash}`;
    } catch { return '/dashboard'; }
  }
}
