import { expect, test, type Page } from '@playwright/test';

const card = (page: Page, word: string) =>
  page.getByRole('region', { name: 'Card tray' }).getByRole('button', { name: word, exact: true });
const smoosh = (page: Page) => page.getByRole('button', { name: 'Smoosh them together' });
const result = (page: Page) => page.getByTestId('result');
const resultCard = (page: Page) => result(page).locator('.card--xl');

// One worker per spec file: five parallel headless WebKits (one per worker) all
// cold-start and contend for CPU, which is what blew the budget before.
test.describe.configure({ mode: 'default' });

test.beforeEach(async ({ page }, testInfo) => {
  // Headless WebKit (phone) is software-rendered in Docker and pays a multi-second
  // first-paint stall per fresh browser; with parallel workers that eats the
  // default 30s budget. Triple it for the phone project.
  if (testInfo.project.name === 'phone') testInfo.slow();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('tap Cat + Dog, smoosh, result appears and the star count becomes 1', async ({ page }) => {
  await expect(page.getByTestId('score')).toContainText('0/');
  await expect(smoosh(page)).toBeDisabled();
  await card(page, 'Cat').click();
  await card(page, 'Dog').click();
  await expect(smoosh(page)).toBeEnabled();
  await smoosh(page).click();
  await expect(resultCard(page)).toBeVisible();
  const word = (await resultCard(page).locator('.card__word').textContent())?.trim() ?? '';
  expect(word.length).toBeGreaterThan(0);
  await expect(resultCard(page)).toHaveClass(/card--new/);
  await expect(page.getByTestId('score')).toContainText('1/');

  // Reload: the discovery persists and the Smooshopedia lists it with its recipe.
  await page.reload();
  await expect(page.getByTestId('score')).toContainText('1/');
  await page.getByRole('button', { name: /Smooshopedia/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toContainText('1 /');
  await expect(dialog.locator('.pedia__entry')).toHaveCount(1);
  await expect(dialog.locator('.pedia__entry .card__word')).toHaveText(word);
  await expect(dialog.locator('.pedia__recipe')).toContainText('Cat');
  await expect(dialog.locator('.pedia__recipe')).toContainText('Dog');
  // Tapping the entry picks it into a slot and closes the modal.
  await dialog.locator('.pedia__entry .card').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-slot="0"]')).toContainText(word);
});

test('typed word + tray card smooshes', async ({ page }) => {
  await page.locator('[data-slot="0"]').click();
  const input = page.getByRole('textbox', { name: /Type a word for slot 1/ });
  await expect(input).toBeFocused();
  await input.fill('shark');
  await input.press('Enter');
  await expect(page.locator('[data-slot="0"]')).toContainText('Shark');
  await card(page, 'Pizza').click();
  await smoosh(page).click();
  await expect(resultCard(page)).toBeVisible();
  const word = (await resultCard(page).locator('.card__word').textContent())?.trim() ?? '';
  expect(word.length).toBeGreaterThan(0);
});

test('Random fills both slots and Enter smooshes', async ({ page }) => {
  await page.getByRole('button', { name: /Random/ }).click();
  await expect(page.locator('[data-slot="0"].slot--filled')).toBeVisible();
  await expect(page.locator('[data-slot="1"].slot--filled')).toBeVisible();
  await expect(smoosh(page)).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(resultCard(page)).toBeVisible();
});

test('mute toggles aria-pressed and persists', async ({ page }) => {
  const mute = page.getByRole('button', { name: /Mute sounds|Unmute sounds/ });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: /Unmute sounds/ })).toHaveAttribute('aria-pressed', 'true');
});

test('result card can be smooshed again and slots clear', async ({ page }) => {
  await card(page, 'Cat').click();
  await card(page, 'Dog').click();
  await smoosh(page).click();
  await expect(resultCard(page)).toBeVisible();
  const word = (await resultCard(page).locator('.card__word').textContent())?.trim() ?? '';
  await resultCard(page).click();
  await expect(page.locator('[data-slot="0"]')).toContainText(word);
  await expect(page.locator('[data-slot="1"].slot--empty')).toBeVisible();
  await page.getByRole('button', { name: 'Clear slot 1' }).click();
  await expect(page.locator('[data-slot="0"].slot--empty')).toBeVisible();
});
