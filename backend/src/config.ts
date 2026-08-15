import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(root, '../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 60),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'https://writing.zaixos.com,http://localhost:5173,chrome-extension://')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  requireKey(): string {
    return required('GROQ_API_KEY');
  },
};
