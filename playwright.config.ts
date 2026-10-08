import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_PATH = '/the-smooshulator/';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  snapshotDir: 'tests/e2e/screenshots',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 0.0.0.0 --port ${PORT}`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'phone',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
