import { describe, expect, it } from 'vitest';
import { coerceCorrectionPayload } from './services/groq.js';

describe('coerceCorrectionPayload', () => {
  it('maps suggestion to corrected', () => {
    const coerced = coerceCorrectionPayload({
      originalText: 'I recive',
      correctedText: 'I receive',
      changes: [
        {
          type: 'spelling',
          original: 'recive',
          suggestion: 'receive',
          start: 2,
          end: 8,
        },
      ],
    }) as {
      changes: Array<{ corrected?: string; suggestion?: string }>;
    };
    expect(coerced.changes[0]?.corrected).toBe('receive');
    expect(coerced.changes[0]?.suggestion).toBeUndefined();
  });

  it('maps punctuation change type to grammar', () => {
    const coerced = coerceCorrectionPayload({
      originalText: 'hi',
      correctedText: 'Hi',
      changes: [{ type: 'punctuation', original: 'hi', corrected: 'Hi', start: 0, end: 2 }],
    }) as { changes: Array<{ type: string }> };
    expect(coerced.changes[0]?.type).toBe('grammar');
  });
});
