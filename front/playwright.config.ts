import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_FRONT_URL ?? 'http://localhost:3100';
const DESTRUCTIVE = '**/documentos-ausentes.e2e.ts';

/**
 * Full-stack E2E of the registration flow (SDD-012, ADR-032). Started by `scripts/test-front-e2e.sh`,
 * which owns the disposable backend, database and fake Brevo. One worker: the backend limits ten
 * challenges per origin/hour, and the destructive project mutates shared legal documents.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: { timeout: 10_000 },
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: DESTRUCTIVE,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      testIgnore: DESTRUCTIVE,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
    // {
    //   name: 'firefox-desktop',
    //   testIgnore: DESTRUCTIVE,
    //   use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    // },
    {
      name: 'destructive',
      testMatch: DESTRUCTIVE,
      dependencies: ['chromium-desktop', 'chromium-mobile', /*'firefox-desktop'*/],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
