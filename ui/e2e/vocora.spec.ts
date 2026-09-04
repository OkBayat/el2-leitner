import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'e2e-admin@example.com';
const ADMIN_PASSWORD = 'password123';

async function authenticate(page: Page, email = ADMIN_EMAIL): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  const registered = await page.waitForURL(/\/dashboard$/u, { timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
  if (!registered) {
    await expect(page.getByRole('alert')).toContainText('already registered');
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in to Vocora' }).click();
  }
  await expect(page).toHaveURL(/\/dashboard$/u);
  await expect(page.getByText("Today's plan")).toBeVisible({ timeout: 10_000 });
}

async function dueTerms(page: Page, minimum = 1): Promise<string[]> {
  let terms: string[] = [];
  await expect.poll(async () => {
    terms = await page.evaluate(async () => {
      const response = await fetch('/api/state', { credentials: 'include' });
      const payload = await response.json();
      const words = Array.isArray(payload.state?.words) ? payload.state.words : [];
      const today = new Date().toLocaleDateString('en-CA');
      return words
        .filter((word: any) => word.box > 0 && !word.masteredAt && word.due && word.due <= today && (!word.blockedUntil || word.blockedUntil <= today))
        .sort((a: any, b: any) => String(a.due).localeCompare(String(b.due)) || b.mistakes - a.mistakes || a.number - b.number)
        .map((word: any) => String(word.term || ''))
        .filter(Boolean);
    });
    return terms.length;
  }, { timeout: 10_000, message: `learner state should expose at least ${minimum} due review card(s)` }).toBeGreaterThanOrEqual(minimum);
  return terms;
}

async function firstDueTerm(page: Page): Promise<string> {
  return (await dueTerms(page, 1))[0];
}

function wrongSpelling(term: string): string {
  return `${term.slice(0, -1)}${term.endsWith('x') ? 'y' : 'x'}`;
}

async function expectFooterAnchoredToViewport(page: Page): Promise<void> {
  const footer = page.getByTestId('review-action-footer');
  await expect(footer).toBeVisible();
  await expect(footer).toHaveCount(1);
  const box = await footer.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(Math.abs((box!.y + box!.height) - viewport!.height)).toBeLessThanOrEqual(2);
  expect(box!.x).toBe(0);
  expect(Math.abs(box!.width - viewport!.width)).toBeLessThanOrEqual(2);
}

async function expectLowercaseMobileInput(input: ReturnType<Page['getByLabel']>): Promise<void> {
  await expect(input).toHaveAttribute('autocomplete', 'off');
  await expect(input).toHaveAttribute('autocapitalize', 'none');
  await expect(input).toHaveAttribute('autocorrect', 'off');
  await expect(input).toHaveAttribute('spellcheck', 'false');
}

async function expectReadonlyCorrectAnswer(input: ReturnType<Page['getByLabel']>): Promise<void> {
  await expect(input).toBeEnabled();
  await expect(input).not.toBeEditable();
  await expect(input).toHaveAttribute('readonly', 'true');
  const field = input.locator('xpath=ancestor::mat-form-field');
  await expect(field).toHaveClass(/review-answer-correct/u);
  await expect(field.locator('.mat-mdc-text-field-wrapper')).toHaveCSS('background-color', 'rgb(215, 255, 184)');
  await expect(field.locator('.mat-mdc-floating-label')).toHaveCSS('color', 'rgb(88, 204, 2)');
  for (const segment of ['.mdc-notched-outline__leading', '.mdc-notched-outline__notch', '.mdc-notched-outline__trailing']) {
    await expect(field.locator(segment)).toHaveCSS('border-top-color', 'rgb(88, 204, 2)');
  }
}

async function installFeedbackSoundSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__vocoraPlayedReviewSounds = [];
    HTMLMediaElement.prototype.play = function play(): Promise<void> {
      const src = this.getAttribute('src') || this.src;
      (window as any).__vocoraPlayedReviewSounds.push(new URL(src, window.location.href).pathname);
      return Promise.resolve();
    };
  });
}

async function expectLastFeedbackSound(page: Page, filename: string): Promise<void> {
  await expect.poll(async () => page.evaluate(() => (window as any).__vocoraPlayedReviewSounds?.at(-1) || null))
    .toBe(`/assets/${filename}`);
}

test('English LTR Angular app preserves the complete learner and library flow', async ({ page }) => {
  await authenticate(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByText('Vocora', { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Today's plan")).toBeVisible();

  const houseStatus = page.getByTestId('house-status');
  await expect(houseStatus).toBeVisible();
  await expect(houseStatus.locator('mat-progress-bar')).toHaveCount(0);
  const houseRows = houseStatus.locator('.leitner-row');
  await expect(houseRows).toHaveCount(5);
  for (const [index, expectedSegments] of [1, 2, 3, 7, 14].entries()) {
    await expect(houseRows.nth(index).locator('.leitner-segment')).toHaveCount(expectedSegments);
  }
  const segmentWidths = await houseRows.locator('.leitner-segments').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  expect(segmentWidths).toHaveLength(5);
  for (let index = 1; index < segmentWidths.length; index += 1) expect(segmentWidths[index]).toBeGreaterThan(segmentWidths[index - 1]);

  await page.goto('/words');
  await expect(page.getByRole('heading', { name: 'Word Bank' })).toBeVisible();
  await page.getByLabel('Search').fill('Monday');
  await expect(page.getByText('Monday', { exact: true })).toBeVisible();

  const dueTerm = await firstDueTerm(page);

  await page.goto('/review');
  await expect(page.getByTestId('review-layout')).toBeVisible();
  await expect(page.locator('app-shell')).toHaveCount(0);
  await expect(page.locator('.sidebar, .topbar, .mobile-nav')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByTestId('review-session-bar')).toBeVisible();
  const sessionAccuracy = page.getByTestId('session-accuracy');
  await expect(sessionAccuracy).toHaveText('Accuracy: —');
  await expectFooterAnchoredToViewport(page);

  const footer = page.getByTestId('review-action-footer');
  const sharedInput = page.getByTestId('review-answer-input');
  const answerInput = page.getByLabel('Your answer');
  const checkAnswer = footer.getByRole('button', { name: 'Check answer' });
  await expect(sharedInput).toHaveCount(1);
  await expect(footer.getByRole('button', { name: "I don't know" })).toBeVisible();
  await expect(checkAnswer).toBeDisabled();
  await expect(answerInput).toBeVisible();
  await expect(answerInput).toBeFocused();
  await expectLowercaseMobileInput(answerInput);
  await answerInput.fill(dueTerm);
  await expect(checkAnswer).toBeEnabled();
  await checkAnswer.click();

  await expect(sessionAccuracy).toHaveText('Accuracy: 100%');
  await expect(sharedInput).toHaveCount(1);
  await expect(answerInput).toBeVisible();
  await expectReadonlyCorrectAnswer(answerInput);
  await expect(answerInput).toHaveValue(dueTerm);
  await expect(footer).toHaveClass(/success/u);
  await expect(footer).toHaveCSS('background-color', 'rgb(215, 255, 184)');
  await expect(footer.getByText('Correct!')).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(footer.locator('.feedback-status-icon svg')).toHaveCount(1);
  await expectFooterAnchoredToViewport(page);

  const savedReview = await page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    const payload = await response.json();
    return payload.state.history.at(-1);
  });
  expect(savedReview.correct).toBe(true);
  expect(savedReview.term).toBe(dueTerm);

  await footer.getByRole('button', { name: 'Continue' }).click();
  await expect(sharedInput).toHaveCount(1);
  await expect(answerInput).toBeVisible();
  await expect(answerInput).toBeEditable();
  await expect(answerInput).toHaveValue('');
  await expect(answerInput).toBeFocused();

  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View details' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'New collection' })).toBeVisible();
  await page.getByRole('button', { name: 'New collection' }).click();
  const collectionTitle = `Angular E2E Collection ${Date.now()}`;
  await page.getByLabel('Title').fill(collectionTitle);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: collectionTitle })).toBeVisible();
  await expect(page.getByTestId('library-detail-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit collection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add word' })).toBeVisible();
  await page.getByRole('button', { name: /Back to library/u }).click();
  await expect(page).toHaveURL(/\/library$/u);

  await page.goto('/leitner-house/1');
  await expect(page.getByRole('heading', { name: 'House 1 words' })).toBeVisible();
  await expect(page.getByLabel('Search words')).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByLabel('New words per day').fill('12');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();

  await page.getByRole('button', { name: 'Create progress story' }).click();
  await expect(page.getByRole('heading', { name: 'Story Studio' })).toBeVisible();
  await expect(page.locator('canvas[width="1080"][height="1920"]')).toBeVisible();
  await expect(page.getByText(/email, typed answers/i)).toBeVisible();
});

test('word edits use a compact request and survive a full page reload', async ({ page }) => {
  await authenticate(page, `e2e-word-edit-${Date.now()}@example.com`);
  await page.goto('/words');
  await page.getByLabel('Search').fill('Monday');
  await expect(page.getByText('Monday', { exact: true })).toBeVisible();

  const writes: Array<{ path: string; body: any }> = [];
  page.on('request', (request) => {
    if (request.method() !== 'PUT') return;
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return;
    writes.push({ path, body: request.postDataJSON() });
  });

  const mondayRow = page.getByRole('row').filter({ hasText: /^Monday/u });
  await mondayRow.hover();
  const editButton = mondayRow.getByRole('button', { name: 'Edit word' });
  await expect(editButton).toBeVisible();
  await editButton.click();
  await page.getByLabel('English word or phrase').fill('Monday edited');
  await page.getByLabel('Alternative spellings separated by /').fill('Monday / Mondays');
  await page.getByLabel('Note or meaning').fill('e2e edit persisted');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Word updated.')).toBeVisible();

  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].path).toMatch(/^\/api\/learning\/vocabulary\//u);
  expect(writes[0].path).not.toBe('/api/state');
  expect(writes[0].body).toEqual(expect.objectContaining({
    term: 'Monday edited',
    acceptedForms: ['Monday edited', 'Monday', 'Mondays'],
    notes: 'e2e edit persisted',
  }));
  expect(writes[0].body).not.toHaveProperty('state');
  expect(writes[0].body).not.toHaveProperty('words');

  await page.reload();
  await page.getByLabel('Search').fill('Monday edited');
  const editedRow = page.getByRole('row').filter({ hasText: /^Monday edited/u });
  await expect(editedRow.locator('strong').filter({ hasText: 'Monday edited' })).toBeVisible();
  await editedRow.hover();
  await editedRow.getByRole('button', { name: 'Edit word' }).click();
  await expect(page.getByLabel('English word or phrase')).toHaveValue('Monday edited');
  await expect(page.getByLabel('Note or meaning')).toHaveValue('e2e edit persisted');
});

test('spelling correction hides the submitted input, keeps no red input state, and preserves feedback sounds', async ({ page }) => {
  await installFeedbackSoundSpy(page);
  await authenticate(page, `e2e-spelling-${Date.now()}@example.com`);
  const term = await firstDueTerm(page);
  const wrong = wrongSpelling(term);

  await page.goto('/review');
  await page.getByRole('button', { name: 'Start session' }).click();
  const footer = page.getByTestId('review-action-footer');
  const sharedInput = page.getByTestId('review-answer-input');
  await expect(sharedInput).toHaveCount(1);
  await page.getByLabel('Your answer').fill(wrong);
  await footer.getByRole('button', { name: 'Check answer' }).click();

  await expect(sharedInput).toHaveCount(0);
  await expect(page.locator('.review-answer-incorrect')).toHaveCount(0);
  await expectLastFeedbackSound(page, 'wrong-answer-song.mp3');
  await expect(footer).toHaveClass(/error/u);
  await expect(footer).toHaveCSS('background-color', 'rgb(255, 223, 224)');
  await expect(footer.getByText('Correct solution:')).toBeVisible();
  await expect(footer).toContainText(term);
  await expect(footer.locator('.feedback-status-icon svg')).toHaveCount(1);
  await expectFooterAnchoredToViewport(page);

  await expect(page.getByRole('heading', { name: 'Spelling correction' })).toBeVisible();
  const userSpelling = page.getByTestId('user-spelling');
  const correctSpelling = page.getByTestId('correct-spelling');
  await expect(userSpelling).toContainText(wrong.toLocaleLowerCase('en'));
  await expect(correctSpelling).toContainText(term.toLocaleLowerCase('en'));
  await expect(userSpelling.locator('.spelling-changed, .spelling-extra')).toHaveCount(1);
  await expect(correctSpelling.locator('.spelling-changed, .spelling-missing')).toHaveCount(1);
  await expect(page.locator('.spelling-hint')).toHaveCount(0);

  await footer.getByRole('button', { name: 'Continue' }).click();
  const recallInput = page.getByLabel('Recall from memory');
  await expect(sharedInput).toHaveCount(1);
  await expect(recallInput).toBeVisible();
  await expect(recallInput).toBeEditable();
  await expect(recallInput).toHaveValue('');
  await expect(recallInput).toBeFocused();
  await expectLowercaseMobileInput(recallInput);
  await expect(footer).toHaveClass(/practice/u);
  await expect(footer.getByRole('heading', { name: 'From memory', exact: true })).toBeVisible();

  await recallInput.fill(`${term}x`);
  await footer.getByRole('button', { name: 'Check answer' }).click();
  await expectLastFeedbackSound(page, 'wrong-answer-song.mp3');
  const copyInput = page.getByLabel('Exact copy');
  await expect(sharedInput).toHaveCount(1);
  await expect(copyInput).toBeVisible();
  await expect(copyInput).toBeEditable();
  await expect(copyInput).toHaveValue('');
  await expect(copyInput).toBeFocused();
  await expect(footer.getByRole('heading', { name: 'Practice the correction', exact: true })).toBeVisible();

  await copyInput.fill(term);
  await footer.getByRole('button', { name: 'Check answer' }).click();
  await expectLastFeedbackSound(page, 'correct-answer-song.mp3');
  const finalRecallInput = page.getByLabel('Recall from memory');
  await expect(sharedInput).toHaveCount(1);
  await expect(finalRecallInput).toBeVisible();
  await expect(finalRecallInput).toBeEditable();
  await expect(finalRecallInput).toHaveValue('');
  await expect(finalRecallInput).toBeFocused();

  await finalRecallInput.fill(term);
  await footer.getByRole('button', { name: 'Check answer' }).click();
  await expect(sharedInput).toHaveCount(1);
  await expect(finalRecallInput).toBeVisible();
  await expectReadonlyCorrectAnswer(finalRecallInput);
  await expectLastFeedbackSound(page, 'correct-answer-song.mp3');
  await expect(finalRecallInput).toHaveValue(term);
  await expect(footer).toHaveClass(/success/u);
  await expect(footer.getByText('Correct!')).toBeVisible();
  await expect(footer.getByText('You remembered the spelling.')).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expectFooterAnchoredToViewport(page);
});

test('scheduled spelling recheck keeps the shared input visible and readonly after a correct answer', async ({ page }) => {
  await authenticate(page, `e2e-recheck-${Date.now()}@example.com`);
  const terms = await dueTerms(page);
  const missedTerm = terms[0];

  await page.goto('/review');
  await page.getByRole('button', { name: 'Start session' }).click();
  const footer = page.getByTestId('review-action-footer');
  const sharedInput = page.getByTestId('review-answer-input');

  const missedInput = page.getByLabel('Your answer');
  await missedInput.fill(wrongSpelling(missedTerm));
  await footer.getByRole('button', { name: 'Check answer' }).click();
  await expect(sharedInput).toHaveCount(0);
  await expect(page.locator('.review-answer-incorrect')).toHaveCount(0);
  await footer.getByRole('button', { name: 'Continue' }).click();

  const immediateRecall = page.getByLabel('Recall from memory');
  await immediateRecall.fill(missedTerm);
  await footer.getByRole('button', { name: 'Check answer' }).click();
  await expect(immediateRecall).toBeVisible();
  await expectReadonlyCorrectAnswer(immediateRecall);
  await expect(immediateRecall).toHaveValue(missedTerm);
  await footer.getByRole('button', { name: 'Continue' }).click();

  const recheckHeading = page.getByRole('heading', { name: 'Spelling recheck' });
  for (let index = 1; index < terms.length; index += 1) {
    await expect.poll(async () => (
      (await recheckHeading.isVisible()) || (await page.getByLabel('Your answer').isVisible())
    ), { timeout: 8_000 }).toBe(true);
    if (await recheckHeading.isVisible()) break;

    const interveningInput = page.getByLabel('Your answer');
    await interveningInput.fill(terms[index]);
    await footer.getByRole('button', { name: 'Check answer' }).click();
    await expect(footer.getByText('Correct!')).toBeVisible();
    await footer.getByRole('button', { name: 'Continue' }).click();
  }

  await expect(recheckHeading).toBeVisible();
  const recheckInput = page.getByLabel('Recall from memory');
  await expect(sharedInput).toHaveCount(1);
  await expect(recheckInput).toBeVisible();
  await expect(recheckInput).toBeEditable();
  await expect(recheckInput).toHaveValue('');
  await expect(recheckInput).toBeFocused();
  await expectLowercaseMobileInput(recheckInput);

  await recheckInput.fill(missedTerm);
  await footer.getByRole('button', { name: 'Check answer' }).click();
  await expect(sharedInput).toHaveCount(1);
  await expect(recheckInput).toBeVisible();
  await expectReadonlyCorrectAnswer(recheckInput);
  await expect(recheckInput).toHaveValue(missedTerm);
  await expect(footer).toHaveClass(/success/u);
  await expect(footer.getByText('Correct!')).toBeVisible();
  await expect(footer.getByText('You remembered the spelling.')).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expectFooterAnchoredToViewport(page);
});

test('review keeps its bottom action footer fitted on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page, `e2e-review-mobile-${Date.now()}@example.com`);
  await firstDueTerm(page);

  await page.goto('/review');
  const layout = page.getByTestId('review-layout');
  await expect(layout).toBeVisible();
  await expect(page.locator('app-shell')).toHaveCount(0);
  await expect(page.locator('.sidebar, .topbar, .mobile-nav')).toHaveCount(0);

  const box = await layout.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBe(0);
  expect(box!.width).toBeGreaterThan(360);
  expect(box!.width).toBeLessThanOrEqual(390);

  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.getByTestId('review-session-bar')).toBeVisible();
  await expect(page.getByTestId('session-accuracy')).toHaveText('Accuracy: —');
  await expect(page.getByRole('button', { name: 'Exit review' })).toBeVisible();
  const answerInput = page.getByLabel('Your answer');
  await expect(page.getByTestId('review-answer-input')).toHaveCount(1);
  await expect(answerInput).toBeVisible();
  await expectLowercaseMobileInput(answerInput);
  await expectFooterAnchoredToViewport(page);
  const footer = page.getByTestId('review-action-footer');
  await expect(footer.getByRole('button', { name: "I don't know" })).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Check answer' })).toBeDisabled();
});