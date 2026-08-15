import {
  CORRECTION_SYSTEM_PROMPT,
  CorrectionResponseSchema,
  coerceCorrectionPayload,
  DEFAULTS,
  type CorrectRequest,
  type CorrectionResponse,
} from '@ewa/shared';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

function truncateForCorrection(text: string): string {
  if (text.length <= DEFAULTS.MAX_CORRECTION_CHARS) return text;
  const slice = text.slice(-DEFAULTS.MAX_CORRECTION_CHARS);
  const boundary = slice.search(/[.!?]\s/);
  if (boundary > 0 && boundary < slice.length / 2) {
    return slice.slice(boundary + 1).trimStart();
  }
  return slice;
}

function normalizeResponse(raw: CorrectionResponse, sourceText: string): CorrectionResponse {
  return {
    originalText: sourceText,
    correctedText: raw.correctedText,
    changes: raw.changes.filter((c) => c.start >= 0 && c.end <= sourceText.length && c.end >= c.start),
  };
}

async function callGroqOnce(
  apiKey: string,
  text: string,
  request: CorrectRequest,
  signal?: AbortSignal,
): Promise<{ parsed: unknown; model: string }> {
  const model = DEFAULTS.GROQ_MODEL_DEFAULT;
  const previousText = request.context?.previousText?.slice(-200);
  const userPayload = previousText
    ? { text, previousText, fieldType: request.context?.fieldType }
    : { text, fieldType: request.context?.fieldType };

  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      response_format: { type: 'json_object' },
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error('invalid_api_key');
    }
    if (res.status === 429) {
      throw new Error('rate_limited');
    }
    throw new Error(`groq_http_${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty model response');

  return {
    parsed: coerceCorrectionPayload(JSON.parse(content) as unknown),
    model,
  };
}

/** Correct text via the user's Groq API key (no Zaixos backend). */
export async function correctWithUserGroqKey(
  apiKey: string,
  request: CorrectRequest,
  signal?: AbortSignal,
): Promise<{ data: CorrectionResponse; model: string; latencyMs: number }> {
  const text = truncateForCorrection(request.text);
  const started = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { parsed, model } = await callGroqOnce(apiKey, text, request, signal);
      const validated = CorrectionResponseSchema.safeParse(parsed);
      if (!validated.success) {
        lastError = validated.error;
        continue;
      }
      return {
        data: normalizeResponse(validated.data, text),
        model,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (err instanceof Error && (err.message === 'invalid_api_key' || err.message === 'rate_limited')) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Correction failed');
}
