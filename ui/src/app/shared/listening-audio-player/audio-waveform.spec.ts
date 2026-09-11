import { describe, expect, it } from 'vitest';
import { createAudioWaveformPaths, normalizedAudioEnergy } from './audio-waveform';

function yCoordinates(path: string): number[] {
  return [...path.matchAll(/[ML] [\d.]+ ([\d.]+)/gu)].map((match) => Number(match[1]));
}

function maximumDeviation(values: number[]): number {
  return Math.max(...values.map((value) => Math.abs(value - 80)));
}

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

  it('uses most of the waveform viewport at peak audio energy', () => {
    const [primaryWave] = createAudioWaveformPaths(1, 0);
    const values = yCoordinates(primaryWave);

    expect(Math.min(...values)).toBeLessThan(15);
    expect(Math.max(...values)).toBeGreaterThan(145);
  });

  it('keeps edge movement subtle while concentrating amplitude near the center', () => {
    const [primaryWave] = createAudioWaveformPaths(1, 1.1);
    const values = yCoordinates(primaryWave);
    const edgeValues = [...values.slice(0, 8), ...values.slice(-8)];
    const centerValues = values.slice(20, 45);

    expect(maximumDeviation(edgeValues)).toBeLessThan(maximumDeviation(centerValues) * 0.4);
  });
});
