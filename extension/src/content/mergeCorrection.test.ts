import { describe, expect, it } from 'vitest';
import { canMergeCorrection, mergeCorrectionIntoField } from './mergeCorrection';

describe('mergeCorrectionIntoField', () => {
  it('replaces an exact match', () => {
    expect(mergeCorrectionIntoField('hello hwo', 'hello hwo', 'hello how')).toBe('hello how');
  });

  it('keeps text typed after the corrected snapshot', () => {
    expect(
      mergeCorrectionIntoField('hello hwo are yuo', 'hello hwo', 'hello how'),
    ).toBe('hello how are yuo');
  });

  it('replaces a trailing segment inside a longer field', () => {
    expect(
      mergeCorrectionIntoField('Intro.\n\nhello hwo', 'hello hwo', 'hello how'),
    ).toBe('Intro.\n\nhello how');
  });

  it('returns null when the user edited inside the snapshot', () => {
    expect(mergeCorrectionIntoField('hello X hwo', 'hello hwo', 'hello how')).toBeNull();
    expect(canMergeCorrection('hello X hwo', 'hello hwo')).toBe(false);
  });

  it('keeps typing after a multi-word fix', () => {
    expect(
      mergeCorrectionIntoField(
        'hello hwo are yuo today',
        'hello hwo are yuo',
        'hello how are you',
      ),
    ).toBe('hello how are you today');
  });
});
