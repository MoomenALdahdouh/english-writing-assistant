import { DEFAULTS, type CorrectionMode } from '@ewa/shared';

export type ExtensionSettings = {
  enabled: boolean;
  highlights: boolean;
  correctionMode: CorrectionMode;
  backendUrl: string;
  consentAccepted: boolean;
};

export type HistoryItem = {
  id: string;
  timestamp: number;
  original: string;
  corrected: string;
};

const SETTINGS_KEY = 'ewa_settings';
const HISTORY_KEY = 'ewa_history';

export const defaultSettings: ExtensionSettings = {
  enabled: DEFAULTS.ENABLED_DEFAULT,
  highlights: DEFAULTS.HIGHLIGHTS_DEFAULT,
  correctionMode: DEFAULTS.CORRECTION_MODE_DEFAULT,
  backendUrl: DEFAULTS.BACKEND_URL,
  consentAccepted: false,
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

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const raw = (result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined) ?? {};
  const merged: ExtensionSettings = {
    ...defaultSettings,
    ...raw,
    correctionMode: normalizeCorrectionMode(raw.correctionMode),
  };
  if (isUnpackedExtension()) {
    // Always use the Herd local URL for unpacked builds (falls back in background).
    merged.backendUrl = DEFAULTS.LOCAL_BACKEND_URL;
  } else if (isLocalBackendUrl(merged.backendUrl)) {
    merged.backendUrl = defaultSettings.backendUrl;
  }
  return merged;
}

export async function setSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
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
