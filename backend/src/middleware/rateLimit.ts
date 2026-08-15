import type { MiddlewareHandler } from 'hono';
import { config } from '../config.js';

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function clientKey(ip: string | undefined): string {
  return ip ?? 'unknown';
}

export const rateLimit: MiddlewareHandler = async (c, next) => {
  const key = clientKey(c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip'));
  const now = Date.now();
  const windowMs = config.rateLimitWindowMs;
  const max = config.rateLimitMax;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= max) {
    return c.json(
      { error: 'rate_limited', message: 'Too many requests. Please slow down.' },
      429,
    );
  }

  bucket.timestamps.push(now);
  await next();
};

/** Test helper */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
