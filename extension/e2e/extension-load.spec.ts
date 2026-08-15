import { chromium, test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(root, '../dist');

test('load unpacked extension and show correction card', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
  expect(manifest.content_scripts[0].js).toEqual(['content.js']);
  expect(fs.existsSync(path.join(extensionPath, 'content.js'))).toBe(true);
  expect(fs.existsSync(path.join(extensionPath, 'assets'))).toBe(false);

  const userDataDir = path.join(root, '.pw-chrome-profile');
  fs.rmSync(userDataDir, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/page.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.locator('#ta').click();
  await page.locator('#ta').fill('I recieve your email.');
  await page.waitForTimeout(1400);

  const host = page.locator('[data-ewa-correction-host]');
  await expect(host).toBeVisible({ timeout: 15000 });
  expect(
    await page.evaluate(() => {
      const row = document.querySelector('[data-ewa-correction-host]');
      return row?.previousElementSibling?.id === 'ta';
    }),
  ).toBe(true);

  await context.close();
});
