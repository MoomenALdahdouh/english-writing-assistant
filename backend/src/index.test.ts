import { describe, expect, it } from 'vitest';
import { app } from './index.js';
import { _resetRateLimitForTests } from './middleware/rateLimit.js';

describe('health', () => {
  it('returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe('correct validation', () => {
  it('rejects empty body', async () => {
    _resetRateLimitForTests();
    const res = await app.request('/api/correct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
