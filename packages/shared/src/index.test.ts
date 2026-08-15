import { describe, expect, it } from 'vitest';
import { CorrectRequestSchema, CorrectionResponseSchema } from './index';

describe('CorrectionResponseSchema', () => {
  it('accepts valid correction payload', () => {
    const result = CorrectionResponseSchema.safeParse({
      originalText: 'I recieve your email.',
      correctedText: 'I receive your email.',
      changes: [
        {
          type: 'spelling',
          original: 'recieve',
          corrected: 'receive',
          start: 2,
          end: 9,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid change type', () => {
    const result = CorrectionResponseSchema.safeParse({
      originalText: 'a',
      correctedText: 'a',
      changes: [{ type: 'style', original: 'a', corrected: 'b', start: 0, end: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects end < start', () => {
    const result = CorrectionResponseSchema.safeParse({
      originalText: 'hello',
      correctedText: 'hello',
      changes: [{ type: 'grammar', original: 'h', corrected: 'H', start: 3, end: 1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('CorrectRequestSchema', () => {
  it('accepts text with optional context', () => {
    const result = CorrectRequestSchema.safeParse({
      text: 'I want improve my English.',
      context: { fieldType: 'textarea' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty text', () => {
    expect(CorrectRequestSchema.safeParse({ text: '' }).success).toBe(false);
  });
});
