import { describe, expect, it, vi } from 'vitest';
import { handleNativeAnchorClick, internalRouteFromNativeUrl, shouldOpenExternally } from './native-lifecycle.service';

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

  it('intercepts an approved absolute anchor and navigates through Angular', async () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://vocora.ir/learning-paths/1?tab=2#lesson';
    const child = document.createElement('span');
    anchor.append(child);
    const preventDefault = vi.fn();
    const navigateByUrl = vi.fn().mockResolvedValue(true);
    const openExternal = vi.fn().mockResolvedValue(undefined);

    const handled = await handleNativeAnchorClick(
      { target: child, preventDefault } as unknown as Event,
      navigateByUrl,
      openExternal,
    );

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/learning-paths/1?tab=2#lesson');
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('intercepts an external anchor without routing it inside the WebView', async () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://www.bbc.co.uk/learningenglish';
    const preventDefault = vi.fn();
    const navigateByUrl = vi.fn().mockResolvedValue(true);
    const openExternal = vi.fn().mockResolvedValue(undefined);

    const handled = await handleNativeAnchorClick(
      { target: anchor, preventDefault } as unknown as Event,
      navigateByUrl,
      openExternal,
    );

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(openExternal).toHaveBeenCalledWith('https://www.bbc.co.uk/learningenglish');
  });
});
