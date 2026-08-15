#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const secretPatterns = [
  /GROQ_API_KEY\s*=\s*["']?gsk_/i,
  /gsk_[A-Za-z0-9]{20,}/,
  /Authorization:\s*Bearer\s+gsk_/i,
];

const targets = [
  path.join(root, 'extension', 'dist'),
  path.join(root, 'extension', 'src'),
  path.join(root, 'packages'),
  path.join(root, 'backend', 'src'),
];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.env') continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(js|ts|tsx|mjs|cjs|json|html|css|map)$/i.test(name)) files.push(full);
  }
  return files;
}

let failed = false;
for (const target of targets) {
  for (const file of walk(target)) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) {
        console.error(`Secret pattern ${pattern} matched in ${path.relative(root, file)}`);
        failed = true;
      }
    }
  }
}

// Backend source may mention the env var name — that is OK unless a real key is present.
// Already covered by gsk_ pattern above.

if (failed) {
  console.error('Secret scan FAILED');
  process.exit(1);
}

console.log(
  'Secret scan passed: no embedded Groq secrets found in client/backend source or extension dist.',
);
