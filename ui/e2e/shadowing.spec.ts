import { expect, test, type Page } from '@playwright/test';

const sentence = 'My name is Sara.';
function assessment(count: number) {
  return { leading: '', words: ['My', 'name', 'is', 'Sara'].map((text, index) => ({ text, after: index === 3 ? '.' : ' ', matched: index < count })),
    transcript: ['my', 'name', 'is', 'sara'].slice(0, count).join(' '), matchedCount: count, totalCount: 4, score: count * 25, passed: count === 4 };
}

async function setup(page: Page, denied = false) {
  await page.addInitScript(({ denied }) => {
    const state: any = { spoken: [], stopped: 0, opened: 0, node: null };
    (window as any).__shadowingTest = state;
    Object.defineProperty(window.speechSynthesis, 'speak', { configurable: true, value: (utterance: SpeechSynthesisUtterance) => state.spoken.push({ text: utterance.text, rate: utterance.rate }) });
    Object.defineProperty(window.speechSynthesis, 'cancel', { configurable: true, value: () => {} });
    Object.defineProperty(window.speechSynthesis, 'getVoices', { configurable: true, value: () => [] });
    const track = { stop: () => state.stopped++, onended: null };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      state.opened++;
      if (denied) throw new DOMException('Denied', 'NotAllowedError');
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    } });
    class Context {
      destination = {}; audioWorklet = { addModule: async () => {} };
      resume = async () => {}; close = async () => {};
      createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
    }
    class Worklet {
      port: any = { onmessage: null, close: () => {}, postMessage: () => queueMicrotask(() => this.port.onmessage?.({ data: { type: 'flushed' } })) };
      constructor() { state.node = this; }
      connect() {} disconnect() {}
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: Context });
    Object.defineProperty(window, 'AudioWorkletNode', { configurable: true, value: Worklet });
  }, { denied });
  let finishCount = 0;
  await page.route('**/api/shadowing/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (request.method() === 'DELETE') return route.fulfill({ status: 204 });
    let json: unknown;
    if (path.endsWith('/sessions')) json = { sessionId: 's', cards: [{ id: 'w', term: 'name', sentences: [{ id: 'sentence', text: sentence, category: 'People', ...assessment(0) }] }], threshold: 90, maxSeconds: 30 };
    else if (path.endsWith('/recordings')) { expect(request.postDataJSON().wordId).toBe('w'); json = { recordingId: 'r' }; }
    else if (path.endsWith('/chunks')) { expect(request.headers()['content-type']).toBe('application/octet-stream'); json = assessment(2); }
    else {
      finishCount++;
      json = { ...assessment(finishCount === 1 ? 3 : 4), counts: { completedCount: finishCount, correctCount: finishCount - 1, wrongCount: 1 },
        daily: { day: '2026-09-05', attempts: finishCount, correct: finishCount - 1, wrong: 1, newAdded: 0, sessions: 0, durationSeconds: 0 } };
    }
    await route.fulfill({ status: 200, json });
  });
  await page.goto('/register');
  await page.getByLabel('Email').fill(`e2e-shadowing-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  await page.goto('/shadowing');
  await expect(page.getByTestId('shadowing-session')).toBeVisible();
}

async function speak(page: Page) {
  await page.getByRole('button', { name: 'Record your voice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const node = (window as any).__shadowingTest.node;
    node.port.onmessage({ data: { type: 'level', rms: .1 } });
    node.port.onmessage({ data: { type: 'pcm', pcm: new ArrayBuffer(16000) } });
  });
  await expect(page.locator('.shadowing-word.recognized')).toHaveCount(2);
  await expect(page.getByTestId('shadowing-feedback')).toHaveClass(/neutral/u);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
}

test('full sentence, live words, retry, success and cleanup without a cloze input', async ({ page }) => {
  await setup(page);
  await expect(page).toHaveURL(/\/shadowing$/u);
  await expect(page.locator('app-shell')).toHaveCount(0);
  await expect(page.getByTestId('shadowing-sentence')).toHaveText(sentence);
  await expect(page.locator('input, textarea')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__shadowingTest.spoken.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__shadowingTest.opened)).toBe(0);
  await page.getByRole('button', { name: 'Play sentence', exact: true }).click();
  await page.getByRole('button', { name: 'Slower', exact: true }).click();
  const voices = await page.evaluate(() => (window as any).__shadowingTest.spoken);
  expect(voices.every((item: any) => item.text === sentence)).toBeTruthy();
  expect(voices[2].rate).toBeLessThan(voices[1].rate);
  await speak(page);
  await expect(page.getByTestId('shadowing-feedback')).toHaveClass(/error/u);
  await expect(page.locator('.shadowing-word.missed')).toHaveText('Sara');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await expect(page.locator('.shadowing-word.recognized')).toHaveCount(0);
  await page.evaluate(() => (window as any).__shadowingTest.node.port.onmessage({ data: { type: 'pcm', pcm: new ArrayBuffer(16000) } }));
  await expect(page.locator('.shadowing-word.recognized')).toHaveCount(2);
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await expect(page.getByTestId('shadowing-feedback')).toHaveClass(/success/u);
  await expect(page.locator('.shadowing-word.recognized')).toHaveCount(4);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.shadowing-word.recognized')).toHaveCount(0);
  await page.getByRole('button', { name: 'Finish practice', exact: true }).click();
  await expect(page.getByText('Shadowing practice complete', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__shadowingTest.stopped)).toBe(2);
});

test('denied microphone access is recoverable and never displayed as a wrong answer', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: 'Record your voice' }).click();
  await expect(page.getByRole('alert')).toContainText('permission was denied');
  await expect(page.getByTestId('shadowing-feedback')).toHaveClass(/neutral/u);
  await expect(page.getByRole('button', { name: 'Record your voice' })).toBeEnabled();
});

test('mobile sentence and microphone fit without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await expect(page.getByTestId('shadowing-sentence')).toBeVisible();
  await expect(page.getByTestId('shadowing-microphone')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
