import { expect, test } from '@playwright/test';

test('Angular Material app preserves the complete learner and library flow', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('ایمیل').fill('e2e-admin@example.com');
  await page.getByLabel('رمز عبور').fill('password123');
  await page.getByRole('button', { name: 'ساخت حساب' }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  await expect(page.getByText('Vocora', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('برنامهٔ امروز')).toBeVisible();

  await page.goto('/words');
  await expect(page.getByRole('heading', { name: 'بانک واژه‌ها' })).toBeVisible();
  await page.getByLabel('جستجو').fill('Monday');
  await expect(page.getByText('Monday', { exact: true })).toBeVisible();

  const firstDueTerm = await page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    const payload = await response.json();
    const today = new Date().toLocaleDateString('en-CA');
    const due = payload.state.words
      .filter((word: any) => word.box > 0 && !word.masteredAt && word.due && word.due <= today && (!word.blockedUntil || word.blockedUntil <= today))
      .sort((a: any, b: any) => String(a.due).localeCompare(String(b.due)) || b.mistakes - a.mistakes || a.number - b.number);
    return due[0]?.term as string | undefined;
  });
  expect(firstDueTerm).toBeTruthy();

  await page.goto('/review');
  await page.getByRole('button', { name: 'شروع جلسه' }).click();
  await expect(page.getByLabel('پاسخ شما')).toBeVisible();
  await page.getByLabel('پاسخ شما').fill(firstDueTerm!);
  await page.getByRole('button', { name: 'بررسی پاسخ' }).click();
  await expect(page.getByText('درست بود!')).toBeVisible();

  const savedReview = await page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    const payload = await response.json();
    return payload.state.history.at(-1);
  });
  expect(savedReview.correct).toBe(true);
  expect(savedReview.term).toBe(firstDueTerm);

  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'کتابخانه' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'مشاهده واژه‌ها' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'مجموعهٔ جدید' })).toBeVisible();
  await page.getByRole('button', { name: 'مجموعهٔ جدید' }).click();
  await page.getByLabel('عنوان').fill('Angular E2E Collection');
  await page.getByRole('button', { name: 'ذخیره' }).click();
  await expect(page.getByRole('heading', { name: 'Angular E2E Collection' })).toBeVisible();
  await page.getByRole('button', { name: 'بستن' }).click();

  await page.goto('/leitner-house/1');
  await expect(page.getByRole('heading', { name: 'واژه‌های خانهٔ ۱' })).toBeVisible();
  await expect(page.getByLabel('جستجوی واژه‌ها')).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'تنظیمات' })).toBeVisible();
  await page.getByLabel('تعداد لغت جدید در روز').fill('12');
  await page.getByRole('button', { name: 'ذخیره تنظیمات' }).click();
  await expect(page.getByText('تنظیمات ذخیره شد.')).toBeVisible();

  await page.getByRole('button', { name: 'ساخت استوری پیشرفت' }).click();
  await expect(page.getByRole('heading', { name: 'Story Studio' })).toBeVisible();
  await expect(page.locator('canvas[width="1080"][height="1920"]')).toBeVisible();
  await expect(page.getByText(/ایمیل، پاسخ تایپ‌شده/u)).toBeVisible();
});
