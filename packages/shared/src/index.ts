import { z } from 'zod';

export const CHANGE_TYPES = ['spelling', 'grammar', 'wording'] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const CorrectionChangeSchema = z.object({
  type: z.enum(CHANGE_TYPES),
  original: z.string(),
  corrected: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export type CorrectionChange = z.infer<typeof CorrectionChangeSchema>;

export const CorrectionResponseSchema = z
  .object({
    originalText: z.string(),
    correctedText: z.string(),
    changes: z.array(CorrectionChangeSchema),
  })
  .superRefine((value, ctx) => {
    for (const change of value.changes) {
      if (change.end < change.start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'change.end must be >= change.start',
          path: ['changes'],
        });
      }
    }
  });

export type CorrectionResponse = z.infer<typeof CorrectionResponseSchema>;

export const FieldTypeSchema = z.enum(['textarea', 'text', 'contenteditable', 'other']);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const CorrectRequestSchema = z.object({
  text: z.string().min(1).max(8000),
  context: z
    .object({
      previousText: z.string().max(2000).optional(),
      fieldType: FieldTypeSchema.optional(),
    })
    .optional(),
});

export type CorrectRequest = z.infer<typeof CorrectRequestSchema>;

/** JSON Schema for Groq structured outputs (strict mode). */
export const GROQ_CORRECTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    originalText: { type: 'string' },
    correctedText: { type: 'string' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...CHANGE_TYPES] },
          original: { type: 'string' },
          corrected: { type: 'string' },
          start: { type: 'integer' },
          end: { type: 'integer' },
        },
        required: ['type', 'original', 'corrected', 'start', 'end'],
        additionalProperties: false,
      },
    },
  },
  required: ['originalText', 'correctedText', 'changes'],
  additionalProperties: false,
} as const;

export const PRODUCT = {
  NAME: 'English Writing Assistant',
  SITE_URL: 'https://writing.zaixos.com',
  API_URL: 'https://writing-api.zaixos.com',
  PRIVACY_URL: 'https://writing.zaixos.com/privacy',
  TERMS_URL: 'https://writing.zaixos.com/terms',
  SUPPORT_EMAIL: 'support@zaixos.com',
  HELLO_EMAIL: 'hello@zaixos.com',
  KOFI_URL: 'https://ko-fi.com/moomenaldahdouh',
} as const;

export const DEFAULTS = {
  DEBOUNCE_MS: 160,
  WORD_BOUNDARY_DEBOUNCE_MS: 80,
  SENTENCE_BOUNDARY_DEBOUNCE_MS: 60,
  MIN_CHARS: 8,
  MIN_WORDS: 3,
  /** Full field text above this is ignored (no UI, no API) — e.g. large pastes. */
  MAX_ASSIST_CHARS: 250,
  MAX_CORRECTION_CHARS: 2000,
  HISTORY_LIMIT: 50,
  CACHE_LIMIT: 50,
  BACKEND_URL: PRODUCT.API_URL,
  LOCAL_BACKEND_URL: 'https://writing-api.test',
  LOCAL_BACKEND_FALLBACK_URL: 'http://127.0.0.1:8787',
  HIGHLIGHTS_DEFAULT: true,
  ENABLED_DEFAULT: true,
  /** 'box' = suggestion row (click to apply); 'direct' = rewrite the field in place */
  CORRECTION_MODE_DEFAULT: 'box' as const,
} as const;

export type CorrectionMode = (typeof DEFAULTS)['CORRECTION_MODE_DEFAULT'] | 'direct';

export const CORRECTION_SYSTEM_PROMPT = `Correct English spelling, grammar, punctuation, and obvious word-usage mistakes. Preserve meaning, tone, contractions, proper nouns, URLs, emails, code, numbers, and quoted text. Do not rewrite for style or add facts. If the text is already correct or is not English writing, return identical originalText and correctedText with empty changes. Return structured JSON only. Change types: spelling, grammar, wording. start/end are exclusive-end offsets in originalText. Prefer the smallest grammatical edit.

Good: "I want to go library tomorrow because I need study." → "I want to go to the library tomorrow because I need to study."
Bad: rewriting that into "I intend to visit the library tomorrow because I need to study."`;
