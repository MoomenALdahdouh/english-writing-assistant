import { CorrectionResponseSchema, DEFAULTS } from '@ewa/shared';
import { hashText, LruCache } from '../shared/cache';
import { createLogger } from '../shared/logger';
import type { ExtensionMessage, CorrectResultMessage } from '../shared/messages';
import {
  addHistoryItem,
  clearHistory,
  getHistory,
  getSettings,
  isUnpackedExtension,
  setSettings,
} from '../storage/settings';

const log = createLogger('background');
const cache = new LruCache<{ originalText: string; correctedText: string; changes: unknown[] }>(
  DEFAULTS.CACHE_LIMIT,
);
const inflight = new Map<string, AbortController>();

chrome.runtime.onInstalled.addListener(() => {
  log.info('installed');
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_SETTINGS':
      return getSettings();
    case 'SET_SETTINGS':
      return setSettings(message.patch);
    case 'GET_HISTORY':
      return getHistory();
    case 'CLEAR_HISTORY':
      await clearHistory();
      return { ok: true };
    case 'ADD_HISTORY':
      return addHistoryItem({
        timestamp: Date.now(),
        original: message.original,
        corrected: message.corrected,
      });
    case 'CANCEL_CORRECT': {
      const controller = inflight.get(message.requestId);
      controller?.abort();
      inflight.delete(message.requestId);
      return { ok: true };
    }
    case 'CORRECT':
      return correct(message.requestId, message.text, message.fieldType, message.previousText);
    default:
      return { error: 'unknown_message' };
  }
}

async function correct(
  requestId: string,
  text: string,
  fieldType?: string,
  previousText?: string,
): Promise<CorrectResultMessage> {
  const settings = await getSettings();
  if (!settings.enabled || !settings.consentAccepted) {
    return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'disabled' };
  }

  const key = hashText(text.trim());
  const cached = cache.get(key);
    if (cached) {
    const validated = CorrectionResponseSchema.safeParse(cached);
    if (validated.success) {
      return { type: 'CORRECT_RESULT', requestId, ok: true, data: validated.data, timing: { backendMs: 0 } };
    }
  }

    inflight.get(requestId)?.abort();
  const controller = new AbortController();
  inflight.set(requestId, controller);
  const fetchStarted = Date.now();

  try {
    const base = settings.backendUrl.replace(/\/$/, '');
    const urls = [base];
    if (base.includes('localhost')) {
      urls.push(base.replace('localhost', '127.0.0.1'));
    } else if (base.includes('127.0.0.1')) {
      urls.push(base.replace('127.0.0.1', 'localhost'));
    }
    if (isUnpackedExtension()) {
      for (const local of [
        DEFAULTS.LOCAL_BACKEND_URL,
        DEFAULTS.LOCAL_BACKEND_FALLBACK_URL,
        'http://localhost:8787',
      ]) {
        if (!urls.includes(local)) urls.push(local);
      }
    }

    let res: Response | null = null;
    let lastErr: unknown;
    for (const url of urls) {
      try {
        res = await fetch(`${url}/api/correct`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-request-id': requestId,
          },
          body: JSON.stringify({
            text,
            context: {
              fieldType,
              previousText,
            },
          }),
          signal: controller.signal,
        });
        break;
      } catch (err) {
        lastErr = err;
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
      }
    }
    if (!res) throw lastErr instanceof Error ? lastErr : new Error('network');

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      log.warn('correct_http_error', res.status, errBody);
      return {
        type: 'CORRECT_RESULT',
        requestId,
        ok: false,
        error: `http_${res.status}`,
      };
    }

    const json: unknown = await res.json();
    const validated = CorrectionResponseSchema.safeParse(json);
    if (!validated.success) {
      log.warn('invalid_response');
      return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'invalid_response' };
    }

    cache.set(key, validated.data);
    const backendMs = Number(res.headers.get('x-ewa-latency-ms')) || Date.now() - fetchStarted;
    const model = res.headers.get('x-ewa-model') ?? undefined;
    log.debug('perf', { requestId, backendMs, model, chars: text.length });
    return {
      type: 'CORRECT_RESULT',
      requestId,
      ok: true,
      data: validated.data,
      timing: { backendMs, model },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { type: 'CORRECT_RESULT', requestId, ok: false, aborted: true, error: 'aborted' };
    }
    log.warn('correct_failed', err instanceof Error ? err.message : 'unknown');
    return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'network' };
  } finally {
    inflight.delete(requestId);
  }
}
