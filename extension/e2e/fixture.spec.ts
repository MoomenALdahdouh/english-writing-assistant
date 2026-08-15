import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(root, '../dist');

test.describe('extension smoke (unpacked)', () => {
  test('fixture page loads editable fields', async () => {
    // Lightweight page-level smoke without requiring extension load in CI sandboxes
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/page.html');
    await expect(page.locator('#ta')).toBeVisible();
    await page.locator('#ta').fill('I recieve your email.');
    await expect(page.locator('#ta')).toHaveValue('I recieve your email.');
    await page.locator('#add-dynamic').click();
    await expect(page.locator('#dyn')).toBeVisible();
    await browser.close();
  });

  test('dist manifest exists for Load unpacked', async () => {
    const fs = await import('node:fs');
    const manifestPath = path.join(extensionPath, 'manifest.json');
    test.skip(!fs.existsSync(manifestPath), 'extension not built yet');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      manifest_version: number;
      name: string;
      background?: { service_worker?: string };
    };
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toContain('English');
    expect(manifest.background?.service_worker).toBe('background.js');
    expect(manifest.content_scripts?.[0]?.js).toContain('content.js');
  });
});
