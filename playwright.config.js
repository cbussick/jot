import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  use: { baseURL: 'http://127.0.0.1:4273', headless: true },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4273', reuseExistingServer: true },
});
