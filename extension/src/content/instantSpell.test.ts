import { describe, expect, it } from 'vitest';
import { applyInstantSpelling } from './instantSpell';

describe('applyInstantSpelling', () => {
  it('fixes completed typo words and keeps the suffix being typed', () => {
    expect(applyInstantSpelling('hello hwo are yuo')).toBe('hello how are you');
    expect(applyInstantSpelling('hello hwo are y')).toBe('hello how are y');
  });

  it('does not rewrite the word currently being typed', () => {
    expect(applyInstantSpelling('hello hw')).toBe('hello hw');
    expect(applyInstantSpelling('I reciv')).toBe('I reciv');
  });

  it('fixes after a trailing space', () => {
    expect(applyInstantSpelling('I recive ')).toBe('I receive ');
  });
});
