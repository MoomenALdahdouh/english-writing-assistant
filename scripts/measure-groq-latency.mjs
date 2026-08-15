import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Groq from 'groq-sdk';
import {
  CORRECTION_SYSTEM_PROMPT,
  GROQ_CORRECTION_JSON_SCHEMA,
} from '../packages/shared/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(root, 'backend/.env') });

const cases = [
  'I recive',
  'I recieve your message',
  'She go to school yesterday',
  'hello I recive',
  'I want to go library tomorrow',
];

const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

function budget() {
  return 1536;
}

async function runOne(client, model, text) {
  const started = Date.now();
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: budget(),
    messages: [
      { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ text }) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'english_correction',
        strict: true,
        schema: GROQ_CORRECTION_JSON_SCHEMA,
      },
    },
  });
  const ms = Date.now() - started;
  const raw = completion.choices[0]?.message?.content ?? '';
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { parseError: true, raw: raw.slice(0, 80) };
  }
  return {
    ms,
    prompt: completion.usage?.prompt_tokens,
    completion: completion.usage?.completion_tokens,
    corrected: parsed?.correctedText ?? null,
    changes: parsed?.changes?.length ?? null,
  };
}

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const rows = [];
for (const model of models) {
  for (const text of cases) {
    try {
      const result = await runOne(client, model, text);
      rows.push({ model, text, ...result });
      console.log(JSON.stringify({ model, text, ...result }));
    } catch (err) {
      rows.push({ model, text, error: err instanceof Error ? err.message : 'unknown' });
      console.log(JSON.stringify({ model, text, error: err instanceof Error ? err.message : 'unknown' }));
    }
  }
}

for (const model of models) {
  const ok = rows.filter((r) => r.model === model && r.ms);
  const avg = ok.reduce((s, r) => s + r.ms, 0) / (ok.length || 1);
  console.log(JSON.stringify({ summary: model, n: ok.length, avgMs: Math.round(avg) }));
}
