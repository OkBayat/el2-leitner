import { expect, test } from '@playwright/test';

test('native AudioWorklet and real speech API handle silence without changing learning progress', async ({ page }) => {
  // Replace only the physical input with a silent MediaStream. AudioContext,
  // AudioWorklet, production CSP, HTTP, authentication, MySQL and Vosk stay real.
  await page.addInitScript(() => {
    (window as any).__shadowingStoppedTracks = 0;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        const context = new AudioContext({ sampleRate: 44100 });
        const source = context.createConstantSource();
        source.offset.value = 0;
        const destination = context.createMediaStreamDestination();
        source.connect(destination);
        source.start();
        await context.resume();
        for (const track of destination.stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            (window as any).__shadowingStoppedTracks++;
            stop();
            source.stop();
            void context.close();
          };
        }
        return destination.stream;
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

  const deckResponse = page.waitForResponse(response => response.url().endsWith('/api/shadowing/sessions') && response.request().method() === 'POST');
  await page.getByTestId('start-shadowing').click();
  expect((await deckResponse).status()).toBe(201);
  // CDP cannot reliably retrieve response bodies consumed by the PWA worker.
  // Assert their real application-visible effects without issuing another POST.
  await expect(page.getByTestId('shadowing-session')).toBeVisible();
  await expect(page.getByTestId('shadowing-sentence')).not.toHaveText('');

  const workletResponse = page.waitForResponse(response => response.url().endsWith('/assets/shadowing/pcm-capture.js'));
  const chunkResponse = page.waitForResponse(response => response.url().includes('/chunks?sequence=0'));
  await page.getByRole('button', { name: 'Record your voice', exact: true }).click();
  expect((await workletResponse).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
  // A successful real chunk endpoint proves that the server received valid,
  // ordered PCM, rather than a stubbed AudioWorklet message or a mocked API.
  expect((await chunkResponse).status()).toBe(200);
  await expect(page.locator('.shadowing-word.recognized')).toHaveCount(0);

  const finishResponse = page.waitForResponse(response => response.url().endsWith('/finish'));
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  expect((await finishResponse).status()).toBe(422);
  await expect(page.getByRole('alert')).toContainText('No clear speech');
  await expect(page.getByTestId('shadowing-feedback')).toHaveClass(/neutral/u);
  expect(await page.evaluate(() => (window as any).__shadowingStoppedTracks)).toBe(1);

  const after = await page.evaluate(async () => (await fetch('/api/state', { credentials: 'include' })).json());
  expect(after.revision).toBe(before.revision);
  expect(after.state.words).toEqual(before.state.words);
  expect(after.state.history).toEqual(before.state.history);
  expect(after.state.daily).toEqual(before.state.daily);
  await page.getByRole('button', { name: 'Exit shadowing', exact: true }).click();
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
});
