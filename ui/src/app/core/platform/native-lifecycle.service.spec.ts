import { describe, expect, it } from 'vitest';
import { internalRouteFromNativeUrl, shouldOpenExternally } from './native-lifecycle.service';

describe('native navigation policy', () => {
  it('keeps approved Vocora links inside Angular', () => {
    expect(internalRouteFromNativeUrl('https://vocora.ir/learning-paths/1?tab=2')).toBe('/learning-paths/1?tab=2');
    expect(internalRouteFromNativeUrl('vocora://app/daily-review')).toBe('/daily-review');
    expect(shouldOpenExternally('https://vocora.ir/library')).toBe(false);
    expect(shouldOpenExternally('https://localhost/library')).toBe(false);
    expect(shouldOpenExternally('capacitor://localhost/library')).toBe(false);
  });

  it('keeps arbitrary websites outside the native WebView', () => {
    expect(internalRouteFromNativeUrl('https://www.bbc.co.uk/learningenglish')).toBeNull();
    expect(shouldOpenExternally('https://www.bbc.co.uk/learningenglish')).toBe(true);
    expect(shouldOpenExternally('mailto:hello@vocora.ir')).toBe(false);
  });
});
