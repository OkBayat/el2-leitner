import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const audioPath = join(tmpdir(), 'vocora-shadowing-ci-silence.wav');

export default async function globalSetup(): Promise<void> {
  const sampleRate = 44_100;
  const bytesPerSample = 2;
  const seconds = 5;
  const size = sampleRate * bytesPerSample * seconds;
  const wav = Buffer.alloc(44 + size);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + size, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * bytesPerSample, 28);
  wav.writeUInt16LE(bytesPerSample, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(size, 40);

  await writeFile(audioPath, wav);
}
