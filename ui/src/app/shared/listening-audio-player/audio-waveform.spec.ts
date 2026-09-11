import { describe, expect, it } from 'vitest';
import { createAudioWaveformPaths, normalizedAudioEnergy } from './audio-waveform';

describe('audio waveform', () => {
  it('normalizes silence and strong samples into a bounded energy value', () => {
    expect(normalizedAudioEnergy(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    expect(normalizedAudioEnergy(new Uint8Array([0, 255, 0, 255]))).toBe(1);
  });

  it('creates three finite paths that respond to energy and phase', () => {
    const idle = createAudioWaveformPaths(0, 0);
    const active = createAudioWaveformPaths(0.8, 1.2);

    expect(idle).toHaveLength(3);
    expect(new Set(active).size).toBe(3);
    expect(active).not.toEqual(idle);
    expect(active.join(' ')).not.toMatch(/NaN|Infinity/u);
  });
});
