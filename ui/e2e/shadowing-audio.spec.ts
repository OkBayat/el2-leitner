import { expect, test } from '@playwright/test';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const audioPath = join(tmpdir(), 'vocora-shadowing-ci-silence.wav');
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${audioPath}`] },
});

test.beforeAll(async () => {
  // Generate deterministic physical-device input without committing a binary.
  const size = 44100 * 2 * 5;
  const wav = Buffer.alloc(44 + size);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + size, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(size, 40);
  await writeFile(audioPath, wav);
});
test.afterAll(async () => { await rm(audioPath, { force: true }); });

test('native AudioWorklet and real speech API handle silence without changing learning progress', async ({ page }) => {
  // Only physical input comes from a test WAV. getUserMedia, AudioContext,
  // AudioWorklet, production CSP, HTTP, authentication, MySQL and Vosk stay real.
  await page.addInitScript(() => {
    const state: { tracks: MediaStreamTrack[] } = { tracks: [] };
    (window as any).__shadowingMicrophone = state;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        const stream = await original(constraints);
        state.tracks.push(...stream.getTracks());
        return stream;
      },
    });
    Object.defineProperty(window.speechSynthesis, 'speak', { configurable: true, value: () => {} });
  });

  await page.goto('/register');
  await page.getByLabel('Email').fill(`e2e-shadowing-native-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  await expect(page.getByTestId('start-shadowing')).toBeVisible();
  const before = await page.evaluate(async () => (await fetch('/api/state', { credentials: 'include' })).json());

  await page.getByTestId('start-shadowing').click();
  // CDP cannot reliably retrieve response bodies consumed by the PWA worker.
  // Assert their real application-visible effects without issuing another POST.
  await expect(page.getByTestId('shadowing-session')).toBeVisible();
  await expect(page.getByTestId('shadowing-sentence')).not.toHaveText('');

  await page.getByRole('button', { name: 'Record your voice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
  // The native worklet has to produce multiple real PCM chunks, not mocked
  // messages. The final endpoint rejects requests without enough received PCM.
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toContainText(/Stop · [1-9]/u);
  await expect(page.locator('.shadowing-word.recognized')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No clear speech');
  await expect(page.getByTestId('shadowing-feedback')).toHaveClass(/neutral/u);
  expect(await page.evaluate(() => (window as any).__shadowingMicrophone.tracks.map((track: MediaStreamTrack) => track.readyState))).toEqual(['ended']);

  const after = await page.evaluate(async () => (await fetch('/api/state', { credentials: 'include' })).json());
  expect(after.revision).toBe(before.revision);
  expect(after.state.words).toEqual(before.state.words);
  expect(after.state.history).toEqual(before.state.history);
  expect(after.state.daily).toEqual(before.state.daily);
  await page.getByRole('button', { name: 'Exit shadowing', exact: true }).click();
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
});
