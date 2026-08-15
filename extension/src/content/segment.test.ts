import { describe, expect, it } from 'vitest';
import { extractWritingContext } from './segment';

describe('extractWritingContext', () => {
  it('sends short text unchanged', () => {
    expect(extractWritingContext('I recieve your message')).toBe('I recieve your message');
  });

  it('prefers the last paragraph of long text', () => {
    const earlier = 'First paragraph is already finished.\n\n';
    const current = 'I recieve your message';
    expect(extractWritingContext(earlier + current)).toBe(current);
  });

  it('prefers the last sentences of a long paragraph', () => {
    const long = `${'Word '.repeat(120)}I recieve your message.`;
    const result = extractWritingContext(long);
    expect(result.includes('I recieve your message')).toBe(true);
    expect(result.length).toBeLessThan(long.length);
  });
});
