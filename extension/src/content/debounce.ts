import { DEFAULTS } from '@ewa/shared';

export type DebounceOptions = {
  defaultMs?: number;
  wordBoundaryMs?: number;
  sentenceBoundaryMs?: number;
};

export function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?]["')\]]?\s*$/.test(text) || /\n\s*$/.test(text);
}

export function endsWithWordBoundary(text: string): boolean {
  return /[ \t]$/.test(text);
}

export function getDebounceDelay(text: string, options: DebounceOptions = {}): number {
  const defaultMs = options.defaultMs ?? DEFAULTS.DEBOUNCE_MS;
  const wordMs = options.wordBoundaryMs ?? DEFAULTS.WORD_BOUNDARY_DEBOUNCE_MS;
  const sentenceMs = options.sentenceBoundaryMs ?? DEFAULTS.SENTENCE_BOUNDARY_DEBOUNCE_MS;
  if (endsWithSentenceBoundary(text)) return sentenceMs;
  if (endsWithWordBoundary(text)) return wordMs;
  return defaultMs;
}

export class IntelligentDebouncer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(
    private readonly run: (text: string, generation: number) => void,
    private readonly options: DebounceOptions = {},
  ) {}

  schedule(text: string): number {
    this.cancel();
    const gen = ++this.generation;
    const delay = getDebounceDelay(text, this.options);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run(text, gen);
    }, delay);
    return gen;
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  currentGeneration(): number {
    return this.generation;
  }

  bump(): number {
    this.cancel();
    return ++this.generation;
  }
}
