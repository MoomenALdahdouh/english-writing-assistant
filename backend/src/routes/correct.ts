import { Hono } from 'hono';
import { CorrectRequestSchema } from '@ewa/shared';
import { correctText } from '../services/groq.js';
import { logger } from '../logger.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { config } from '../config.js';
import { randomUUID } from 'node:crypto';

export const correctRoute = new Hono();

correctRoute.post('/', rateLimit, async (c) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  const body = await c.req.json().catch(() => null);
  const parsed = CorrectRequestSchema.safeParse(body);

  if (!parsed.success) {
    logger.warn('invalid_request', { requestId, issues: parsed.error.issues.length });
    return c.json(
      { error: 'invalid_request', message: 'Invalid correction request payload.', requestId },
      400,
    );
  }

  try {
    const started = Date.now();
    const result = await correctText(parsed.data, requestId);
    const latencyMs = Date.now() - started;
    c.header('X-EWA-Latency-Ms', String(latencyMs));
    c.header('X-EWA-Model', config.groqModel);
    return c.json(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Correction failed';
    const isAuth =
      message.toLowerCase().includes('api key') ||
      message.toLowerCase().includes('unauthorized') ||
      message.includes('401');
    const isRate =
      message.toLowerCase().includes('rate') || message.includes('429');

    if (isAuth) {
      return c.json({ error: 'upstream_auth', message: 'Correction service misconfigured.', requestId }, 502);
    }
    if (isRate) {
      return c.json({ error: 'upstream_rate_limited', message: 'Upstream busy. Try again.', requestId }, 503);
    }
    return c.json({ error: 'correction_failed', message: 'Unable to correct text.', requestId }, 502);
  }
});
