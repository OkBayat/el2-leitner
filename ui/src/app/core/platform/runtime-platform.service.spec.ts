import { describe, expect, it } from 'vitest';
import { resolveRuntimeUrl } from './runtime-platform.service';

describe('resolveRuntimeUrl', () => {
  it('preserves relative API URLs for the web target', () => {
    expect(resolveRuntimeUrl('/api/auth/me', false, '')).toBe('/api/auth/me');
  });

  it('resolves API URLs against the native HTTPS origin', () => {
    expect(resolveRuntimeUrl('/api/auth/me', true, 'https://vocora.ir')).toBe('https://vocora.ir/api/auth/me');
  });

  it('does not rewrite local assets and rejects insecure native API origins', () => {
    expect(resolveRuntimeUrl('/assets/icons/logo.svg', true, 'https://vocora.ir')).toBe('/assets/icons/logo.svg');
    expect(() => resolveRuntimeUrl('/api/auth/me', true, 'http://vocora.ir')).toThrow(/HTTPS/u);
  });
});
