import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  globalSetup: './tests/global-setup.ts',
  use: {
    headless: true,
    trace: 'retain-on-failure',
  },
});
