export type AudioWaveformPaths = readonly [string, string, string];

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_CENTER_Y = 80;
const SEGMENT_COUNT = 64;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizedAudioEnergy(samples: Uint8Array): number {
  if (samples.length === 0) return 0;

  let sum = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sum += normalized * normalized;
  }
  return clamp(Math.sqrt(sum / samples.length) * 3.2, 0, 1);
}

export function audioWaveformPhaseAdvance(elapsedMilliseconds: number, energy: number): number {
  return Math.max(0, elapsedMilliseconds) * (0.0056 + clamp(energy, 0, 1) * 0.0044);
}

function wavePath(amplitude: number, frequency: number, phase: number): string {
  const points: string[] = [];
  for (let index = 0; index <= SEGMENT_COUNT; index += 1) {
    const progress = index / SEGMENT_COUNT;
    const x = progress * VIEWBOX_WIDTH;
    const primary = Math.sin(progress * Math.PI * 2 * frequency + phase);
    const harmonic = Math.sin(progress * Math.PI * 2 * (frequency * 0.48) - phase * 0.7) * 0.22;
    const centerEnvelope = 0.12 + Math.pow(Math.sin(progress * Math.PI), 1.5) * 0.88;
    const y = VIEWBOX_CENTER_Y + (primary + harmonic) * amplitude * centerEnvelope;
    points.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(' ');
}

export function createAudioWaveformPaths(energy: number, phase: number): AudioWaveformPaths {
  const response = 0.22 + clamp(energy, 0, 1) * 0.78;
  return [
    wavePath(120 * response, 4.15, phase),
    wavePath(92 * response, 3.05, phase * -0.82 + 1.15),
    wavePath(68 * response, 1.8, phase * 0.56 + 2.4),
  ];
}
