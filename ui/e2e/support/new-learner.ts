import { expect, type Page } from '@playwright/test';

export function waitForDailyActivation(page: Page) {
  return page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/learning/vocabulary-activation-batches'
    && response.ok()
  ));
}

export async function finishNewLearnerWelcome(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/welcome$/u);
  const dailyActivation = waitForDailyActivation(page);
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await dailyActivation;
  await expect(page).toHaveURL(/\/dashboard$/u);
}
