import { DEFAULTS, type CorrectionMode } from '@ewa/shared';

export type ExtensionSettings = {
  enabled: boolean;
  highlights: boolean;
  correctionMode: CorrectionMode;
  backendUrl: string;
  consentAccepted: boolean;
  /** User-owned Groq key — stored in chrome.storage.local only (never sync). */
  groqApiKey: string;
};

export type HistoryItem = {
  id: string;
  timestamp: number;
  original: string;
  corrected: string;
};

const SETTINGS_KEY = 'ewa_settings';
const API_KEY_KEY = 'ewa_groq_api_key';
const HISTORY_KEY = 'ewa_history';

export const defaultSettings: ExtensionSettings = {
  enabled: DEFAULTS.ENABLED_DEFAULT,
  highlights: DEFAULTS.HIGHLIGHTS_DEFAULT,
  correctionMode: DEFAULTS.CORRECTION_MODE_DEFAULT,
  backendUrl: DEFAULTS.BACKEND_URL,
  consentAccepted: false,
  groqApiKey: '',
};

const LOCAL_BACKEND =
  /^https?:\/\/((localhost|127\.0\.0\.1)(:\d+)?|writing-api\.test)(\/|$)/i;

export function isLocalBackendUrl(url: string): boolean {
  return LOCAL_BACKEND.test(url);
}

export function isUnpackedExtension(): boolean {
  try {
    return !chrome.runtime.getManifest().update_url;
  } catch {
    return false;
  }
}

function normalizeCorrectionMode(value: unknown): CorrectionMode {
  return value === 'direct' ? 'direct' : 'box';
}

function normalizeApiKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function getStoredApiKey(): Promise<string> {
  const result = await chrome.storage.local.get(API_KEY_KEY);
  return normalizeApiKey(result[API_KEY_KEY]);
}

export async function getSettings(): Promise<ExtensionSettings> {
  const [syncResult, groqApiKey] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    getStoredApiKey(),
  ]);
  const raw = (syncResult[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined) ?? {};
  const { groqApiKey: _ignoredKey, ...rest } = raw;
  const merged: ExtensionSettings = {
    ...defaultSettings,
    ...rest,
    correctionMode: normalizeCorrectionMode(raw.correctionMode),
    groqApiKey,
  };
  if (isUnpackedExtension()) {
    merged.backendUrl = DEFAULTS.LOCAL_BACKEND_URL;
  } else if (isLocalBackendUrl(merged.backendUrl)) {
    merged.backendUrl = defaultSettings.backendUrl;
  }
  return merged;
}

export async function setSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };

  if (Object.prototype.hasOwnProperty.call(patch, 'groqApiKey')) {
    await chrome.storage.local.set({ [API_KEY_KEY]: normalizeApiKey(patch.groqApiKey) });
    next.groqApiKey = normalizeApiKey(patch.groqApiKey);
  }

  const { groqApiKey: _key, ...syncable } = next;
  await chrome.storage.sync.set({ [SETTINGS_KEY]: syncable });
  return next;
}

export async function getHistory(): Promise<HistoryItem[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  return (result[HISTORY_KEY] as HistoryItem[] | undefined) ?? [];
}

export async function addHistoryItem(item: Omit<HistoryItem, 'id'>): Promise<HistoryItem[]> {
  const history = await getHistory();
  const nextItem: HistoryItem = {
    ...item,
    id: `${item.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const next = [nextItem, ...history].slice(0, DEFAULTS.HISTORY_LIMIT);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}
