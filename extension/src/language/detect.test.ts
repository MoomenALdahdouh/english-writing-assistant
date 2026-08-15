import { describe, expect, it } from 'vitest';
import {
  detectEnglish,
  hasDominantNonLatinScript,
  isEligibleForCorrection,
  isNonEnglishWriting,
  shouldShowEnglishAssistant,
  shouldSkipTinySample,
} from './detect';

describe('language detection', () => {
  it('skips tiny samples', () => {
    expect(shouldSkipTinySample('Hi')).toBe(true);
    expect(shouldSkipTinySample('Hello')).toBe(true);
    expect(shouldSkipTinySample('I')).toBe(true);
    expect(shouldSkipTinySample('Thanks')).toBe(true);
  });

  it('hides the card for short Arabic like مرحبا', () => {
    expect(hasDominantNonLatinScript('مرحبا')).toBe(true);
    expect(detectEnglish('مرحبا').reason).toBe('non_latin_script');
    expect(isNonEnglishWriting('مرحبا')).toBe(true);
    expect(shouldShowEnglishAssistant('مرحبا')).toBe(false);
    expect(isEligibleForCorrection('مرحبا')).toBe(false);
  });

  it('rejects Arabic and hides as non-English', () => {
    expect(detectEnglish('مرحبا كيف حالك').isEnglish).toBe(false);
    expect(isEligibleForCorrection('مرحبا كيف حالك')).toBe(false);
    expect(isNonEnglishWriting('مرحبا كيف حالك')).toBe(true);
    expect(shouldShowEnglishAssistant('مرحبا كيف حالك')).toBe(false);
  });

  it('rejects Turkish', () => {
    expect(detectEnglish('Merhaba nasılsın').isEnglish).toBe(false);
    expect(isEligibleForCorrection('Merhaba nasılsın')).toBe(false);
    expect(isNonEnglishWriting('Merhaba nasılsın')).toBe(true);
    expect(shouldShowEnglishAssistant('Merhaba nasılsın')).toBe(false);
  });

  it('rejects Spanish and French', () => {
    expect(isEligibleForCorrection('Hola como estas amigo')).toBe(false);
    expect(shouldShowEnglishAssistant('Hola como estas amigo')).toBe(false);
    expect(isEligibleForCorrection('Bonjour comment allez vous')).toBe(false);
    expect(shouldShowEnglishAssistant('Bonjour comment allez vous')).toBe(false);
  });

  it('rejects Cyrillic and CJK', () => {
    expect(shouldShowEnglishAssistant('Привет как дела')).toBe(false);
    expect(isEligibleForCorrection('你好吗朋友')).toBe(false);
  });

  it('accepts English sentences', () => {
    expect(
      detectEnglish('I am studying software engineering and I want improve my English.').isEnglish,
    ).toBe(true);
    expect(isEligibleForCorrection('I recieve your email.')).toBe(true);
    expect(shouldShowEnglishAssistant('I recieve your email.')).toBe(true);
  });

  it('accepts short English misspellings', () => {
    expect(isEligibleForCorrection('I recive')).toBe(true);
    expect(shouldShowEnglishAssistant('I recive')).toBe(true);
    expect(isEligibleForCorrection('I receie')).toBe(true);
  });

  it('keeps UI visible for typo Latin without function words', () => {
    expect(detectEnglish('hell hwo ate').reason).toBe('low_english_score');
    expect(isNonEnglishWriting('hell hwo ate')).toBe(false);
    expect(shouldShowEnglishAssistant('hell hwo ate')).toBe(true);
  });

  it('still skips incomplete fragments', () => {
    expect(isEligibleForCorrection('I rece')).toBe(false);
    expect(isEligibleForCorrection('Hi')).toBe(false);
  });

  it('accepts text with URL', () => {
    expect(isEligibleForCorrection('Please check https://example.com and tell me.')).toBe(true);
  });

  it('ignores long pastes over 250 characters', () => {
    const long = `${'I need help with English writing. '.repeat(20)}extra`;
    expect(long.length).toBeGreaterThan(250);
    expect(shouldShowEnglishAssistant(long)).toBe(false);
    expect(isEligibleForCorrection(long)).toBe(false);
    expect(shouldShowEnglishAssistant(long.slice(0, 250))).toBe(true);
  });
});
