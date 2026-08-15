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
import { correctWithUserGroqKey } from './groqCorrect';

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

  try {
    // Preferred path for public use: user's own Groq key (no hosted backend required).
    if (settings.groqApiKey) {
      try {
        const result = await correctWithUserGroqKey(
          settings.groqApiKey,
          { text, context: { fieldType: fieldType as 'textarea' | 'text' | 'contenteditable' | 'other' | undefined, previousText } },
          controller.signal,
        );
        cache.set(key, result.data);
        log.debug('perf', { requestId, backendMs: result.latencyMs, model: result.model, chars: text.length, via: 'user_key' });
        return {
          type: 'CORRECT_RESULT',
          requestId,
          ok: true,
          data: result.data,
          timing: { backendMs: result.latencyMs, model: result.model },
        };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { type: 'CORRECT_RESULT', requestId, ok: false, aborted: true, error: 'aborted' };
        }
        const msg = err instanceof Error ? err.message : 'unknown';
        log.warn('groq_direct_failed', msg);
        if (msg === 'invalid_api_key') {
          return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'invalid_api_key' };
        }
        if (msg === 'rate_limited') {
          return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'rate_limited' };
        }
        return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'network' };
      }
    }

    // No user key: public builds require BYOK. Unpacked/dev can use a local backend.
    if (!isUnpackedExtension()) {
      return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'missing_api_key' };
    }
    return correctViaBackend(requestId, text, fieldType, previousText, settings.backendUrl, controller);
  } finally {
    inflight.delete(requestId);
  }
}

async function correctViaBackend(
  requestId: string,
  text: string,
  fieldType: string | undefined,
  previousText: string | undefined,
  backendUrl: string,
  controller: AbortController,
): Promise<CorrectResultMessage> {
  const fetchStarted = Date.now();
  try {
    const base = backendUrl.replace(/\/$/, '');
    const urls: string[] = [];
    const pushUnique = (url: string) => {
      if (url && !urls.includes(url)) urls.push(url);
    };
    if (isUnpackedExtension()) {
      pushUnique(DEFAULTS.LOCAL_BACKEND_FALLBACK_URL);
      pushUnique('http://localhost:8787');
      pushUnique(DEFAULTS.LOCAL_BACKEND_URL);
    }
    pushUnique(base);
    if (base.includes('localhost')) {
      pushUnique(base.replace('localhost', '127.0.0.1'));
    } else if (base.includes('127.0.0.1')) {
      pushUnique(base.replace('127.0.0.1', 'localhost'));
    }

    let res: Response | null = null;
    let lastErr: unknown;
    let lastStatus = 0;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;
      try {
        const attempt = await fetch(`${url}/api/correct`, {
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
        if (!attempt.ok && attempt.status >= 500 && i < urls.length - 1) {
          lastStatus = attempt.status;
          continue;
        }
        res = attempt;
        break;
      } catch (err) {
        lastErr = err;
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
      }
    }
    if (!res) {
      // No user key and no reachable backend — guide them to paste a key.
      return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'missing_api_key' };
    }

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

    cache.set(hashText(text.trim()), validated.data);
    const backendMs = Number(res.headers.get('x-ewa-latency-ms')) || Date.now() - fetchStarted;
    const model = res.headers.get('x-ewa-model') ?? undefined;
    log.debug('perf', { requestId, backendMs, model, chars: text.length, via: 'backend' });
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
    return { type: 'CORRECT_RESULT', requestId, ok: false, error: 'missing_api_key' };
  }
}
