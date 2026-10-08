import { expect, test } from '@playwright/test';

test('loads The Smooshulator', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Smooshulator/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Smooshulator');
  await page.screenshot({
    path: `tests/e2e/screenshots/smoke-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
