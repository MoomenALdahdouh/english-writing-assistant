import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function writeManifest() {
  const manifest = {
    manifest_version: 3,
    name: 'English Writing Assistant',
    version: '1.3.13',
    description: 'Inline English spelling and grammar corrections while you type on the web.',
    homepage_url: 'https://writing.zaixos.com',
    action: {
      default_popup: 'popup.html',
      default_title: 'English Writing Assistant',
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
    },
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    permissions: ['storage'],
    host_permissions: [
      'https://writing-api.zaixos.com/*',
      'https://writing-api.test/*',
      'http://127.0.0.1:8787/*',
      'http://localhost:8787/*',
    ],
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*'],
        js: ['content.js'],
        run_at: 'document_idle',
        all_frames: true,
      },
    ],
  };
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

const alias = { '@': path.join(root, 'src') };

async function main() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  // Content: IIFE, fully inlined — injected directly by Chrome (no getURL / WAR)
  await build({
    configFile: false,
    root,
    resolve: { alias },
    build: {
      outDir: dist,
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: path.join(root, 'src/content/index.ts'),
        name: 'EWAContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          extend: true,
        },
      },
    },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  });

  // Background: single ES module
  await build({
    configFile: false,
    root,
    resolve: { alias },
    build: {
      outDir: dist,
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: path.join(root, 'src/background/index.ts'),
        formats: ['es'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
    },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  });

  // Popup
  await build({
    configFile: false,
    root,
    plugins: [react()],
    resolve: { alias },
    build: {
      outDir: dist,
      emptyOutDir: false,
      sourcemap: true,
      rollupOptions: {
        input: path.join(root, 'popup-entry.html'),
        output: {
          entryFileNames: 'popup/[name].js',
          chunkFileNames: 'popup/[name].js',
          assetFileNames: 'popup/[name][extname]',
        },
      },
    },
  });

  // Move built html to popup.html
  const builtHtml = path.join(dist, 'popup-entry.html');
  if (fs.existsSync(builtHtml)) {
    let html = fs.readFileSync(builtHtml, 'utf8');
    // Rewrite absolute-ish vite paths to relative popup assets
    html = html.replace(/(src|href)="\/popup\//g, '$1="./popup/');
    html = html.replace(/(src|href)="popup\//g, '$1="./popup/');
    fs.writeFileSync(path.join(dist, 'popup.html'), html);
    fs.unlinkSync(builtHtml);
  }

  copyDir(path.join(publicDir, 'icons'), path.join(dist, 'icons'));
  writeManifest();

  // Sanity checks
  for (const f of ['manifest.json', 'content.js', 'background.js', 'popup.html']) {
    if (!fs.existsSync(path.join(dist, f))) {
      throw new Error(`Missing build output: ${f}`);
    }
  }
  const content = fs.readFileSync(path.join(dist, 'content.js'), 'utf8');
  if (content.includes('chrome.runtime.getURL')) {
    throw new Error('content.js still uses chrome.runtime.getURL — expected plain IIFE');
  }
  console.log('OK: extension/dist ready (IIFE content.js)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
