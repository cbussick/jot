import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:4273',
    headless: true,
    storageState: '.auth/user.json',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'rm -rf .test-data && npm run build && PORT=4273 DATA_DIR=.test-data NODE_ENV=test node dist/server/server/index.js',
    url: 'http://127.0.0.1:4273/healthz',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
