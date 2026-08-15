import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'extension/dist');
const outDir = path.join(root, 'store');
const zip = path.join(outDir, 'english-writing-assistant.zip');

if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
  throw new Error('Build the extension first: npm run build -w extension');
}

const manifestPath = path.join(dist, 'manifest.json');
const devManifest = fs.readFileSync(manifestPath, 'utf8');
const storeManifest = JSON.parse(devManifest);
storeManifest.host_permissions = ['https://writing-api.zaixos.com/*'];
storeManifest.optional_host_permissions = [
  'https://writing-api.test/*',
  'http://localhost:8787/*',
  'http://127.0.0.1:8787/*',
];
fs.writeFileSync(manifestPath, JSON.stringify(storeManifest, null, 2));

fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(zip)) fs.unlinkSync(zip);

const maps = [];
for (const file of fs.readdirSync(dist, { recursive: true })) {
  if (String(file).endsWith('.map')) maps.push(file);
}

try {
  execSync(`zip -r "${zip}" . -x "*.map"`, { cwd: dist, stdio: 'inherit' });
} finally {
  fs.writeFileSync(manifestPath, devManifest);
}

const manifest = JSON.parse(devManifest);
console.log(`OK: ${zip}`);
console.log(`version ${manifest.version}; excluded ${maps.length} source maps`);
