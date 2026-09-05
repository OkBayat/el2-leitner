import { afterEach, describe, expect, it, vi } from 'vitest';
import { PcmRecorderService } from './pcm-recorder.service';

describe('PcmRecorderService', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('releases tracks if permission arrives after the user has left', async () => {
    const stop = vi.fn(); const close = vi.fn().mockResolvedValue(undefined);
    let grant!: (value: unknown) => void;
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(resolve => { grant = resolve; }) } });
    vi.stubGlobal('AudioWorkletNode', class {});
    vi.stubGlobal('AudioContext', class { resume = () => Promise.resolve(); close = close; });
    const recorder = new PcmRecorderService();
    const opening = recorder.open(); recorder.cancel();
    grant({ getTracks: () => [{ stop }] });
    await expect(opening).rejects.toMatchObject({ name: 'AbortError' });
    expect(stop).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalled();
  });
  it('does not request microphone permission in an insecure context', async () => {
    vi.stubGlobal('isSecureContext', false);
    const request = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: request } });
    const recorder = new PcmRecorderService();
    await expect(recorder.open()).rejects.toThrow('HTTPS');
    expect(request).not.toHaveBeenCalled();
  });
});
