import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LruCache, hashText } from '../shared/cache';

describe('cache', () => {
  it('hashes stably', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });

  it('evicts oldest entries', () => {
    const cache = new LruCache<string>(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });
});

describe('request cancellation semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('only newest generation should be considered valid', async () => {
    let latest = 0;
    const accepted: number[] = [];
    const schedule = (gen: number, delay: number) => {
      latest = gen;
      setTimeout(() => {
        if (gen === latest) accepted.push(gen);
      }, delay);
    };
    schedule(1, 100);
    schedule(2, 50);
    await vi.advanceTimersByTimeAsync(120);
    expect(accepted).toEqual([2]);
    vi.useRealTimers();
  });
});
