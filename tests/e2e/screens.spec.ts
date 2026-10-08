import { expect, test, type Page } from '@playwright/test';

/**
 * Screenshots for the playtest agents: home, result (Blanket + Daddy), Smooshopedia,
 * plus a seeded "full" Smooshopedia. Viewport shots, not fullPage: the app is a
 * fixed 100dvh shell with the tray scrolling inside it, so "what the kid sees" is
 * exactly the viewport. The in-viewport assertions guard the phone layout: the
 * score pill, the toolbar and the fresh result must all be on screen unscrolled.
 */

// Wait for fonts and two painted frames so the shot has no half-swapped text.
async function settle(page: Page): Promise<void> {
  // String form: the e2e tsconfig has no DOM lib.
  await page.evaluate(
    'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))',
  );
}

// One worker per spec file: five parallel headless WebKits (one per worker) all
// cold-start and contend for CPU, which is what blew the budget before.
test.describe.configure({ mode: 'default' });

const fullyVisible = { ratio: 1 } as const;
const toolbar = (page: Page) => page.getByRole('navigation', { name: 'Tools' });

test.beforeEach(async ({ page }, testInfo) => {
  // Headless WebKit (phone) is software-rendered in Docker: give it room.
  if (testInfo.project.name === 'phone') testInfo.slow();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('screens', async ({ page }, testInfo) => {
  const name = testInfo.project.name;
  const shot = async (what: string): Promise<void> => {
    await settle(page);
    await page.screenshot({ path: `tests/e2e/screenshots/${name}-${what}.png` });
  };

  // A fresh save pre-fills the flagship pair (Blanket + Daddy); wait for it so the
  // home shot shows the real first impression.
  await expect(page.locator('[data-slot="0"]')).toContainText('Blanket');
  await expect(page.locator('[data-slot="1"]')).toContainText('Daddy');
  await expect(page.getByTestId('score')).toBeInViewport(fullyVisible);
  await expect(toolbar(page)).toBeInViewport(fullyVisible);
  await expect(page.getByRole('button', { name: 'Mute sounds' })).toBeInViewport(fullyVisible);
  await shot('home');

  await page.getByRole('button', { name: 'Smoosh them together' }).click();
  const resultCard = page.getByTestId('result').locator('.card--xl');
  await expect(resultCard).toBeVisible();
  await expect(resultCard).toHaveClass(/card--new/);
  // Let the pop-in / confetti settle so the screenshot is stable.
  await page.waitForTimeout(900);
  await expect(resultCard).toBeInViewport(fullyVisible);
  await expect(page.getByRole('button', { name: 'Copy this smoosh' })).toBeInViewport(fullyVisible);
  await expect(toolbar(page)).toBeInViewport(fullyVisible);
  await expect(page.getByTestId('score')).toBeInViewport(fullyVisible);
  await shot('result');

  await page.getByRole('button', { name: /Smooshopedia/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400);
  await shot('pedia');
});

test('Smooshopedia scrolls when full', async ({ page }, testInfo) => {
  // Seed 30 discoveries straight into storage (the persisted shape of src/state/store.ts).
  const seed = { version: 1, discovered: {} as Record<string, unknown>, log: [] as unknown[], muted: false };
  for (let i = 0; i < 30; i++) {
    const id = `seed-${i}`;
    seed.discovered[id] = { id, word: `Seed Thing ${i}`, emoji: '🐱🐶', tags: [], modifiers: ['Seed'], base: false };
    seed.log.push({ key: id, cardId: id, inputs: ['cat', 'dog'], at: 1700000000000 + i, source: 'mash' });
  }
  // Written from an init script so it lands before the app's own first save():
  // a plain evaluate() can race the freshly reloaded page's mount effect.
  await page.addInitScript((raw: string) => localStorage.setItem('smooshulator.v1', raw), JSON.stringify(seed));
  await page.reload();
  await expect(page.getByTestId('score')).toHaveText(/★\s*30$/);

  await page.getByRole('button', { name: /Smooshopedia/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.pedia__entry')).toHaveCount(30);
  // Header and footer stay put; only the grid scrolls, and it has room to.
  await expect(dialog.getByRole('heading')).toBeInViewport(fullyVisible);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport(fullyVisible);
  const grid = dialog.locator('.modal__grid');
  const scrollable = await grid.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrollable).toBe(true);
  await grid.evaluate((el) => el.scrollTo(0, 400));
  expect(await grid.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await grid.evaluate((el) => el.scrollTo(0, 0));
  await settle(page);
  await page.screenshot({ path: `tests/e2e/screenshots/${testInfo.project.name}-pedia-full.png` });
});
