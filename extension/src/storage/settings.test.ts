import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  runtime: {
    getManifest: vi.fn(() => ({})),
  },
  storage: {
    sync: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(store, obj);
      }),
    },
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(store, obj);
      }),
    },
  },
});

describe('settings and history storage', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it('persists settings and history with limit', async () => {
    const {
      getSettings,
      setSettings,
      addHistoryItem,
      getHistory,
      clearHistory,
    } = await import('./settings');

    const s = await setSettings({ highlights: false, correctionMode: 'direct' });
    expect(s.highlights).toBe(false);
    expect(s.correctionMode).toBe('direct');
    expect((await getSettings()).highlights).toBe(false);
    expect((await getSettings()).correctionMode).toBe('direct');
    expect((await getSettings()).correctionMode).not.toBe('box');

    await setSettings({ correctionMode: 'box' });
    expect((await getSettings()).correctionMode).toBe('box');

    for (let i = 0; i < 55; i++) {
      await addHistoryItem({
        timestamp: i,
        original: `o${i}`,
        corrected: `c${i}`,
      });
    }
    const history = await getHistory();
    expect(history.length).toBe(50);
    expect(history[0]?.original).toBe('o54');

    await clearHistory();
    expect(await getHistory()).toEqual([]);
  });

  it('uses the local backend when the extension is unpacked', async () => {
    const { getSettings } = await import('./settings');
    expect((await getSettings()).backendUrl).toBe('https://writing-api.test');
  });

  it('keeps the production API for store builds', async () => {
    vi.mocked(chrome.runtime.getManifest).mockReturnValue({
      manifest_version: 3,
      name: 'English Writing Assistant',
      version: '1.3.4',
      update_url: 'https://clients2.google.com/service/update2/crx',
    } as chrome.runtime.Manifest);
    const { getSettings } = await import('./settings');
    expect((await getSettings()).backendUrl).toBe('https://writing-api.zaixos.com');
  });

  it('stores the Groq API key in local storage only', async () => {
    const { getSettings, setSettings } = await import('./settings');

    await setSettings({ groqApiKey: '  gsk_test_key  ' });
    expect((await getSettings()).groqApiKey).toBe('gsk_test_key');
    expect(store.ewa_groq_api_key).toBe('gsk_test_key');

    const synced = store.ewa_settings as Record<string, unknown> | undefined;
    expect(synced?.groqApiKey).toBeUndefined();

    await setSettings({ groqApiKey: '' });
    expect((await getSettings()).groqApiKey).toBe('');
  });
});
