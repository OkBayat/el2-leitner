import { chromium, expect, test } from '@playwright/test';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const audioPath = join(tmpdir(), 'vocora-shadowing-ci-silence.wav');

async function writeSilenceAudio(): Promise<void> {
  const sampleRate = 44_100;
  const channels = 2;
  const bytesPerSample = 2;
  const seconds = 5;
  const blockAlign = channels * bytesPerSample;
  const size = sampleRate * seconds * blockAlign;
  const wav = Buffer.alloc(44 + size);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + size, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * blockAlign, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(size, 40);

  await writeFile(audioPath, wav);
}

test('native AudioWorklet and real speech API handle silence without changing learning progress', async () => {
  await writeSilenceAudio();
  const browser = await chromium.launch({
    channel: 'chrome',
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${audioPath}`,
    ],
  });

  try {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:3000',
      permissions: ['microphone'],
    });
    const page = await context.newPage();

    // Observe the native APIs without replacing their implementation or results.
    page.on('console', message => {
      if (message.text().startsWith('[native-audio]')) console.log(message.text());
    });
    await page.addInitScript(() => {
      const state: { tracks: MediaStreamTrack[] } = { tracks: [] };
      (window as any).__shadowingMicrophone = state;
      const note = (name: string, value = '') => console.log(`[native-audio] ${name} ${value}`);
      const failure = (name: string, error: unknown) => note(name, error instanceof Error || error instanceof DOMException ? `${error.name}: ${error.message}` : String(error));
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async (constraints: MediaStreamConstraints) => {
          note('microphone.request');
          try {
            const stream = await original(constraints);
            state.tracks.push(...stream.getTracks());
            note('microphone.granted');
            return stream;
          } catch (error) { failure('microphone.failed', error); throw error; }
        },
      });
      const resume = AudioContext.prototype.resume;
      AudioContext.prototype.resume = function () {
        note('context.resume', this.state);
        return resume.call(this).then(() => note('context.running', this.state), error => { failure('context.failed', error); throw error; });
      };
      const addModule = AudioWorklet.prototype.addModule;
      AudioWorklet.prototype.addModule = function (url: string | URL, options?: WorkletOptions) {
        note('worklet.request', String(url));
        return addModule.call(this, url, options).then(() => note('worklet.loaded'), error => { failure('worklet.failed', error); throw error; });
      };
      const source = AudioContext.prototype.createMediaStreamSource;
      AudioContext.prototype.createMediaStreamSource = function (stream: MediaStream) {
        try { const node = source.call(this, stream); note('microphone.connected'); return node; }
        catch (error) { failure('microphone.connectionFailed', error); throw error; }
      };
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
    await expect(page.getByTestId('shadowing-session')).toBeVisible();
    await expect(page.getByTestId('shadowing-sentence')).not.toHaveText('');

    await page.getByRole('button', { name: 'Record your voice', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
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
  } finally {
    await browser.close();
    await rm(audioPath, { force: true });
  }
});
