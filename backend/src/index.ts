import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { correctRoute } from './routes/correct.js';

const app = new Hono();

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true;
  return config.corsOrigins.some((rule) =>
    rule.endsWith('://') ? origin.startsWith(rule) : origin === rule || rule === '*',
  );
}

app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Request-Id'],
    exposeHeaders: ['X-EWA-Latency-Ms', 'X-EWA-Model'],
  }),
);

app.get('/health', (c) =>
  c.json({
    ok: true,
    model: config.groqModel,
    hasKey: Boolean(config.groqApiKey),
  }),
);

app.route('/api/correct', correctRoute);

app.onError((err, c) => {
  logger.error('unhandled', { error: err.message });
  return c.json({ error: 'internal', message: 'Internal server error' }, 500);
});

if (process.env.NODE_ENV !== 'test') {
  if (!config.groqApiKey) {
    logger.warn('missing_groq_key', {
      message: 'GROQ_API_KEY is not set. /api/correct will fail until configured.',
    });
  }

  serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
    logger.info('server_started', { port: info.port, model: config.groqModel });
  });
}

export { app };
