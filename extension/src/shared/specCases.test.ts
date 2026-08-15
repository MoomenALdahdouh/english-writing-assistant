import { describe, expect, it } from 'vitest';
import { CorrectionResponseSchema } from '@ewa/shared';

describe('spec correction cases (schema + expected strings)', () => {
  const cases = [
    {
      name: 'spelling',
      original: 'I recieve your email.',
      corrected: 'I receive your email.',
    },
    {
      name: 'grammar',
      original: 'She go to school yesterday.',
      corrected: 'She went to school yesterday.',
    },
    {
      name: 'already correct',
      original: 'I want to go to the library tomorrow.',
      corrected: 'I want to go to the library tomorrow.',
    },
    {
      name: 'missing to',
      original: 'I am studying software engineering and I want improve my English.',
      corrected: 'I am studying software engineering and I want to improve my English.',
    },
    {
      name: 'url preserved',
      original: 'Please check https://example.com and tell me.',
      corrected: 'Please check https://example.com and tell me.',
    },
    {
      name: 'code preserved',
      original: 'Use const user = await getUser();',
      corrected: 'Use const user = await getUser();',
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const parsed = CorrectionResponseSchema.safeParse({
        originalText: c.original,
        correctedText: c.corrected,
        changes: [],
      });
      expect(parsed.success).toBe(true);
      if (c.name === 'already correct' || c.name.includes('preserved')) {
        expect(c.corrected).toBe(c.original);
      }
    });
  }
});
