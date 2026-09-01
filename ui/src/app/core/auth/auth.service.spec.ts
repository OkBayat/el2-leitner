import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ApiClientService } from '../http/api-client.service';

function createService() {
  const api = { get: vi.fn(), post: vi.fn() };
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({ providers: [AuthService, { provide: ApiClientService, useValue: api }, { provide: Router, useValue: router }] });
  return { service: TestBed.inject(AuthService), api, router };
}

describe('AuthService regression contracts', () => {
  it('normalizes email and validates registration password bounds', () => {
    const { service } = createService();
    expect(service.validate(' USER@Example.COM ', 'password123', true)).toEqual({ email: 'user@example.com', password: 'password123' });
    expect(() => service.validate('not-email', 'password123', false)).toThrow(/ایمیل معتبر/u);
    expect(() => service.validate('user@example.com', 'short', true)).toThrow(/حداقل ۸/u);
    expect(() => service.validate('user@example.com', '🙂'.repeat(19), true)).toThrow(/۷۲ بایت/u);
  });

  it('allows only same-origin local return targets', () => {
    const { service } = createService();
    expect(service.safeReturnTo('/reports?range=30#accuracy')).toBe('/reports?range=30#accuracy');
    expect(service.safeReturnTo('https://evil.example/steal')).toBe('/dashboard');
    expect(service.safeReturnTo('//evil.example/steal')).toBe('/dashboard');
    expect(service.safeReturnTo('/\\evil.example/steal')).toBe('/dashboard');
  });

  it('uses the auth endpoints and stores the authenticated user', async () => {
    const { service, api } = createService();
    api.post.mockResolvedValue({ user: { id: 7, email: 'user@example.com' } });
    await service.login('USER@example.com', 'password123');
    expect(api.post).toHaveBeenCalledWith('/api/auth/login', { email: 'user@example.com', password: 'password123' });
    expect(service.user()?.email).toBe('user@example.com');
  });
});
