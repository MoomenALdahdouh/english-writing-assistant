import Groq from 'groq-sdk';
import {
  CORRECTION_SYSTEM_PROMPT,
  CorrectionResponseSchema,
  DEFAULTS,
  GROQ_CORRECTION_JSON_SCHEMA,
  type CorrectRequest,
  type CorrectionResponse,
} from '@ewa/shared';
import { config } from '../config.js';
import { logger } from '../logger.js';

function truncateForCorrection(text: string): string {
  if (text.length <= DEFAULTS.MAX_CORRECTION_CHARS) return text;
  const slice = text.slice(-DEFAULTS.MAX_CORRECTION_CHARS);
  const boundary = slice.search(/[.!?]\s/);
  if (boundary > 0 && boundary < slice.length / 2) {
    return slice.slice(boundary + 1).trimStart();
  }
  return slice;
}

let sharedClient: Groq | null = null;

function getClient(): Groq {
  if (!sharedClient) {
    sharedClient = new Groq({ apiKey: config.requireKey() });
  }
  return sharedClient;
}

function completionBudget(): number {
  // gpt-oss uses reasoning tokens inside max_tokens; a tight cap truncates JSON.
  return 1536;
}

async function callGroqOnce(
  client: Groq,
  text: string,
  request: CorrectRequest,
): Promise<{ parsed: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
  const previousText = request.context?.previousText?.slice(-200);
  const userPayload = previousText
    ? { text, previousText, fieldType: request.context?.fieldType }
    : { text, fieldType: request.context?.fieldType };

  // Groq structured outputs (json_schema). SDK typings lag the HTTP API.
  const completion = (await client.chat.completions.create({
    model: config.groqModel,
    temperature: 0.1,
    max_tokens: completionBudget(),
    messages: [
      { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify(userPayload),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'english_correction',
        strict: true,
        schema: GROQ_CORRECTION_JSON_SCHEMA,
      },
    },
  } as unknown as Parameters<typeof client.chat.completions.create>[0])) as {
    choices: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty model response');
  }

  return {
    parsed: JSON.parse(content) as unknown,
    usage: completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
        }
      : undefined,
  };
}

function normalizeResponse(raw: CorrectionResponse, sourceText: string): CorrectionResponse {
  // Prefer the client's original text for consistency
  return {
    originalText: sourceText,
    correctedText: raw.correctedText,
    changes: raw.changes.filter((c) => c.start >= 0 && c.end <= sourceText.length && c.end >= c.start),
  };
}

export async function correctText(
  request: CorrectRequest,
  requestId: string,
): Promise<CorrectionResponse> {
  const text = truncateForCorrection(request.text);
  const client = getClient();
  const started = Date.now();

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { parsed, usage } = await callGroqOnce(client, text, request);
      const validated = CorrectionResponseSchema.safeParse(parsed);
      if (!validated.success) {
        lastError = validated.error;
        logger.warn('correction_schema_invalid', {
          requestId,
          attempt,
          issues: validated.error.issues.length,
        });
        continue;
      }

      const result = normalizeResponse(validated.data, text);
      logger.info('correction_ok', {
        requestId,
        model: config.groqModel,
        latencyMs: Date.now() - started,
        status: 'ok',
        changeCount: result.changes.length,
        unchanged: result.originalText === result.correctedText,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        textLength: text.length,
      });
      return result;
    } catch (err) {
      lastError = err;
      logger.warn('correction_attempt_failed', {
        requestId,
        attempt,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  logger.error('correction_failed', {
    requestId,
    model: config.groqModel,
    latencyMs: Date.now() - started,
    status: 'error',
    error: lastError instanceof Error ? lastError.message : 'unknown',
  });
  throw lastError instanceof Error ? lastError : new Error('Correction failed');
}
