import { describe, expect, it, vi } from 'vitest';
import { DEFAULTS } from '@ewa/shared';
import {
  endsWithSentenceBoundary,
  endsWithWordBoundary,
  getDebounceDelay,
  IntelligentDebouncer,
} from '../content/debounce';

describe('debounce', () => {
  it('detects sentence boundaries', () => {
    expect(endsWithSentenceBoundary('Hello.')).toBe(true);
    expect(endsWithSentenceBoundary('Hello?')).toBe(true);
    expect(endsWithSentenceBoundary('Hello!\n')).toBe(true);
    expect(endsWithSentenceBoundary('Hello world')).toBe(false);
  });

  it('detects word boundaries', () => {
    expect(endsWithWordBoundary('I recive ')).toBe(true);
    expect(endsWithWordBoundary('I recive')).toBe(false);
  });

  it('uses faster delay after a word or sentence', () => {
    expect(getDebounceDelay('Done.')).toBe(DEFAULTS.SENTENCE_BOUNDARY_DEBOUNCE_MS);
    expect(getDebounceDelay('I recive ')).toBe(DEFAULTS.WORD_BOUNDARY_DEBOUNCE_MS);
    expect(getDebounceDelay('Still typing')).toBe(DEFAULTS.DEBOUNCE_MS);
  });

  it('cancels stale scheduled work', async () => {
    vi.useFakeTimers();
    const calls: Array<{ text: string; gen: number }> = [];
    const d = new IntelligentDebouncer((text, generation) => {
      calls.push({ text, gen: generation });
    });
    d.schedule('one');
    d.schedule('two');
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual([{ text: 'two', gen: 2 }]);
    vi.useRealTimers();
  });

  it('bump invalidates previous generation', () => {
    const d = new IntelligentDebouncer(() => undefined);
    d.schedule('a');
    const g = d.bump();
    expect(g).toBe(2);
    expect(d.currentGeneration()).toBe(2);
  });
});
