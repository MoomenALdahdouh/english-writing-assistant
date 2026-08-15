import { useCallback, useEffect, useState } from 'react';
import { PRODUCT } from '@ewa/shared';
import type { HistoryItem, ExtensionSettings } from '../storage/settings';
import { HistoryList } from './HistoryDiff';

export function App() {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const load = useCallback(async () => {
    const [s, h] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) as Promise<ExtensionSettings>,
      chrome.runtime.sendMessage({ type: 'GET_HISTORY' }) as Promise<HistoryItem[]>,
    ]);
    setSettingsState(s);
    setApiKeyDraft(s.groqApiKey ?? '');
    setHistory(h);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchSettings(patch: Partial<ExtensionSettings>) {
    setBusy(true);
    try {
      const next = (await chrome.runtime.sendMessage({
        type: 'SET_SETTINGS',
        patch,
      })) as ExtensionSettings;
      setSettingsState(next);
      if (Object.prototype.hasOwnProperty.call(patch, 'groqApiKey')) {
        setApiKeyDraft(next.groqApiKey);
        setKeySaved(true);
        window.setTimeout(() => setKeySaved(false), 1600);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveApiKey() {
    const trimmed = apiKeyDraft.trim();
    await patchSettings({ groqApiKey: trimmed });
  }

  async function onClearHistory() {
    setBusy(true);
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
      setHistory([]);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <main className="shell" aria-busy="true">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!settings.consentAccepted) {
    return (
      <main className="shell">
        <header className="header">
          <div className="brand">
            <div className="logo" aria-hidden="true">
              E
            </div>
            <div>
              <h1>English Assistant</h1>
              <p className="muted">Quick setup</p>
            </div>
          </div>
        </header>
        <section className="panel consent" aria-label="Privacy disclosure">
          <h2>Your writing, your key</h2>
          <p className="consent-copy">
            Corrections run with <strong>your</strong> free Groq API key. Text goes to Groq to
            suggest spelling and grammar fixes — not to sell ads.
          </p>
          <ul className="consent-list">
            <li>Your API key stays on this device</li>
            <li>Passwords and code editors are ignored</li>
            <li>You can pause or clear history anytime</li>
          </ul>
          <a className="policy-link" href={PRODUCT.PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Privacy policy
          </a>
          <button
            type="button"
            className="agree"
            disabled={busy}
            onClick={() => void patchSettings({ consentAccepted: true })}
          >
            Continue
          </button>
        </section>
        <style>{css}</style>
      </main>
    );
  }

  const hasKey = Boolean(settings.groqApiKey);
  const keyDirty = apiKeyDraft.trim() !== settings.groqApiKey;

  return (
    <main className="shell">
      <header className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            E
          </div>
          <div>
            <h1>English Assistant</h1>
            <p className="muted status">
              <span
                className={`dot ${settings.enabled && hasKey ? 'on' : 'off'}`}
                aria-hidden="true"
              />
              {!hasKey ? 'Add API key' : settings.enabled ? 'Active' : 'Paused'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="ghost"
          disabled={busy}
          aria-pressed={settings.enabled}
          onClick={() => void patchSettings({ enabled: !settings.enabled })}
        >
          {settings.enabled ? 'Pause' : 'Resume'}
        </button>
      </header>

      <section className={`panel ${hasKey ? '' : 'setup'}`} aria-label="Groq API key">
        <div className="row">
          <div>
            <h2>Groq API key</h2>
            <p className="muted">Free from Groq — required to correct text</p>
          </div>
          <a
            className="link"
            href={PRODUCT.GROQ_KEYS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get free key
          </a>
        </div>
        <div className="key-row">
          <input
            className="key-input"
            type={showKey ? 'text' : 'password'}
            name="groqApiKey"
            autoComplete="off"
            spellCheck={false}
            placeholder="gsk_…"
            value={apiKeyDraft}
            disabled={busy}
            onChange={(e) => setApiKeyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && keyDirty) void saveApiKey();
            }}
            aria-label="Groq API key"
          />
          <button
            type="button"
            className="ghost tight"
            disabled={busy}
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="key-actions">
          <button
            type="button"
            className="agree compact"
            disabled={busy || !keyDirty}
            onClick={() => void saveApiKey()}
          >
            {keySaved ? 'Saved' : hasKey && !keyDirty ? 'Saved' : 'Save key'}
          </button>
          {hasKey ? (
            <button
              type="button"
              className="link"
              disabled={busy}
              onClick={() => {
                setApiKeyDraft('');
                void patchSettings({ groqApiKey: '' });
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel" aria-label="Correction mode">
        <h2>Mode</h2>
        <div className="mode-switch" role="radiogroup" aria-label="Correction mode">
          <button
            type="button"
            className={`mode-option ${settings.correctionMode !== 'direct' ? 'active' : ''}`}
            role="radio"
            aria-checked={settings.correctionMode !== 'direct'}
            disabled={busy}
            onClick={() => void patchSettings({ correctionMode: 'box' })}
          >
            <span className="mode-title">Suggestion box</span>
            <span className="mode-desc">Show fixes under the field</span>
          </button>
          <button
            type="button"
            className={`mode-option ${settings.correctionMode === 'direct' ? 'active' : ''}`}
            role="radio"
            aria-checked={settings.correctionMode === 'direct'}
            disabled={busy}
            onClick={() => void patchSettings({ correctionMode: 'direct' })}
          >
            <span className="mode-title">Direct edit</span>
            <span className="mode-desc">Fix text as you type</span>
          </button>
        </div>
      </section>

      {settings.correctionMode !== 'direct' ? (
        <section className="panel" aria-label="Highlight settings">
          <div className="row">
            <div>
              <h2>Highlights</h2>
              <p className="muted">Color spelling & grammar</p>
            </div>
            <button
              type="button"
              className={`toggle ${settings.highlights ? 'on' : ''}`}
              role="switch"
              aria-checked={settings.highlights}
              disabled={busy}
              onClick={() => void patchSettings({ highlights: !settings.highlights })}
            >
              <span className="knob" />
              <span className="label">{settings.highlights ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel" aria-label="Recent corrections">
        <div className="row">
          <h2>Recent</h2>
          <button
            type="button"
            className="link"
            disabled={busy || history.length === 0}
            onClick={() => void onClearHistory()}
          >
            Clear
          </button>
        </div>
        {history.length === 0 ? (
          <p className="muted empty">Corrections will show up here</p>
        ) : (
          <HistoryList items={history} />
        )}
      </section>

      <footer className="support">
        <nav className="legal" aria-label="Support and legal">
          <a href={PRODUCT.SITE_URL} target="_blank" rel="noopener noreferrer">
            Website
          </a>
          <a href={PRODUCT.PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Privacy
          </a>
          <a href={`mailto:${PRODUCT.SUPPORT_EMAIL}`}>Support</a>
        </nav>
        <a className="kofi" href={PRODUCT.KOFI_URL} target="_blank" rel="noopener noreferrer">
          Support the project
        </a>
      </footer>

      <style>{css}</style>
    </main>
  );
}

const css = `
.shell { display: flex; flex-direction: column; gap: 10px; }
.header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.brand { display: flex; gap: 10px; align-items: center; }
.logo {
  width: 34px; height: 34px; border-radius: 10px;
  display: grid; place-items: center; color: white; font-weight: 700;
  background: linear-gradient(145deg, #0f766e, #115e59);
}
h1 { margin: 0; font-size: 15px; letter-spacing: -0.02em; }
h2 { margin: 0; font-size: 13px; font-weight: 650; }
.muted { margin: 0; color: var(--muted); font-size: 12px; }
.status { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; }
.dot.on { background: #0f766e; box-shadow: 0 0 0 3px var(--accent-soft); }
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px;
}
.panel.setup { border-color: rgba(15, 118, 110, 0.35); box-shadow: 0 0 0 3px var(--accent-soft); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.key-row { display: flex; gap: 8px; margin-top: 10px; }
.key-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0 10px;
  font: inherit;
  font-size: 12px;
  color: var(--ink);
  background: #fff;
}
.key-input:focus {
  outline: 2px solid rgba(15, 118, 110, 0.35);
  outline-offset: 1px;
}
.key-actions { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.mode-switch { display: grid; gap: 8px; margin-top: 8px; }
.mode-option {
  display: grid; gap: 2px; text-align: left;
  border: 1px solid var(--line); background: #fff;
  border-radius: 12px; padding: 10px 12px; cursor: pointer; color: var(--ink);
}
.mode-option:hover:not(:disabled) { border-color: rgba(15, 118, 110, 0.35); }
.mode-option.active {
  border-color: rgba(15, 118, 110, 0.55);
  background: rgba(15, 118, 110, 0.06);
}
.mode-option:disabled { opacity: 0.55; cursor: not-allowed; }
.mode-title { font-size: 13px; font-weight: 650; }
.mode-desc { font-size: 11.5px; color: var(--muted); line-height: 1.35; }
.ghost, .link {
  border: 1px solid var(--line); background: white;
  border-radius: 999px; padding: 6px 10px; cursor: pointer; color: var(--ink);
}
.ghost.tight { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
.link { border: none; background: transparent; color: var(--accent); padding: 0; font-size: 12px; }
.ghost:disabled, .link:disabled, .toggle:disabled, .agree:disabled { opacity: 0.5; cursor: not-allowed; }
.toggle {
  position: relative; width: 64px; height: 32px; border-radius: 999px; border: none;
  background: #d7ded9; cursor: pointer; padding: 0;
}
.toggle.on { background: var(--accent); }
.knob {
  position: absolute; top: 3px; left: 3px; width: 26px; height: 26px;
  border-radius: 50%; background: white; transition: transform 140ms ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.toggle.on .knob { transform: translateX(32px); }
.label {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 10px; font-weight: 700; color: white; padding-left: 18px;
}
.toggle:not(.on) .label { color: #374151; padding-left: 0; padding-right: 18px; }
.history { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 0; max-height: 220px; overflow: auto; }
.history li { border-top: 1px solid var(--line); padding: 10px 0; }
.history li:first-child { border-top: none; padding-top: 0; }
.history li:last-child { padding-bottom: 0; }
.hist-entry { display: grid; gap: 6px; }
.hist-text { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--ink); white-space: pre-wrap; word-break: break-word; }
.hist-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.hist-badge {
  display: inline-flex; align-items: center; font-size: 10px; font-weight: 650;
  color: var(--muted); background: #f3f4f6; border-radius: 999px; padding: 2px 7px;
}
.hist-badge.edits { color: #0f766e; background: rgba(15, 118, 110, 0.1); }
.hist-same .hist-text { color: var(--muted); font-weight: 500; }
.hist-was { font-size: 11px; color: var(--muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.hist-mark { border-radius: 3px; padding: 0 1px; font-weight: 650; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.hist-mark.wrong { text-decoration: line-through; text-decoration-thickness: 1.5px; opacity: 0.9; }
.hist-mark.wrong.spelling, .hist-mark.fix.spelling { color: #be123c; background: rgba(244, 63, 94, 0.12); }
.hist-mark.wrong.grammar, .hist-mark.fix.grammar { color: #a16207; background: rgba(202, 138, 4, 0.14); }
.hist-mark.wrong.wording, .hist-mark.fix.wording { color: #3730a3; background: rgba(99, 102, 241, 0.1); }
.empty { margin-top: 8px; }
.consent-copy { margin: 8px 0 0; font-size: 13px; line-height: 1.45; color: var(--ink); }
.consent-list { margin: 10px 0 0; padding-left: 18px; font-size: 12px; color: var(--muted); line-height: 1.5; }
.policy-link { display: inline-block; margin-top: 10px; color: var(--accent); font-size: 12px; }
.agree {
  display: block; width: 100%; margin-top: 14px; min-height: 40px;
  border: none; border-radius: 12px; cursor: pointer;
  background: var(--accent); color: white; font-weight: 650;
}
.agree.compact { width: auto; margin-top: 0; min-height: 34px; padding: 0 14px; font-size: 12px; }
.support { display: flex; flex-direction: column; gap: 8px; padding-top: 2px; }
.legal { display: flex; justify-content: center; gap: 14px; }
.legal a { color: var(--muted); font-size: 11px; text-decoration: none; }
.legal a:hover { color: var(--accent); }
.kofi {
  display: inline-flex; align-items: center; justify-content: center;
  width: 100%; min-height: 36px; border-radius: 12px;
  border: 1px solid rgba(180, 83, 9, 0.16);
  background: #fff7ed; color: #9a3412; font-size: 12px; font-weight: 650; text-decoration: none;
}
`;
