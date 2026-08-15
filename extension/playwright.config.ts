import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
  },
  webServer: {
    command: 'npx --yes serve fixtures -p 4173',
    cwd: root,
    port: 4173,
    reuseExistingServer: true,
  },
});
