import { useCallback, useEffect, useState } from 'react';
import { PRODUCT } from '@ewa/shared';
import type { HistoryItem, ExtensionSettings } from '../storage/settings';
import { HistoryList } from './HistoryDiff';

export function App() {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, h] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) as Promise<ExtensionSettings>,
      chrome.runtime.sendMessage({ type: 'GET_HISTORY' }) as Promise<HistoryItem[]>,
    ]);
    setSettingsState(s);
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
    } finally {
      setBusy(false);
    }
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
              <p className="muted">Before we start</p>
            </div>
          </div>
        </header>
        <section className="panel consent" aria-label="Privacy disclosure">
          <h2>How your writing is handled</h2>
          <p className="consent-copy">
            When you type English on a website, this extension sends that text to Zaixos servers
            so an AI model (Groq) can suggest spelling and grammar corrections.
          </p>
          <ul className="consent-list">
            <li>Used only to generate your correction</li>
            <li>Not sold, and not used for ads</li>
            <li>Passwords and code editors are ignored</li>
          </ul>
          <a className="policy-link" href={PRODUCT.PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Read the privacy policy
          </a>
          <button
            type="button"
            className="agree"
            disabled={busy}
            onClick={() => void patchSettings({ consentAccepted: true })}
          >
            I agree and continue
          </button>
        </section>
        <style>{css}</style>
      </main>
    );
  }

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
              <span className={`dot ${settings.enabled ? 'on' : 'off'}`} aria-hidden="true" />
              {settings.enabled ? 'Active' : 'Paused'}
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

      <section className="panel" aria-label="Correction mode">
        <div>
          <h2>How corrections appear</h2>
          <p className="muted mode-lead">Pick one style — they are separate modes</p>
        </div>
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
            <span className="mode-desc">Show edits under the field. Click the box to apply.</span>
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
            <span className="mode-desc">Rewrite the text in place while you type. No box.</span>
          </button>
        </div>
      </section>

      <section className="panel" aria-label="Highlight settings">
        <div className="row">
          <div>
            <h2>Highlights</h2>
            <p className="muted">
              {settings.correctionMode === 'direct'
                ? 'Only used in suggestion box mode'
                : 'Color spelling, grammar, wording'}
            </p>
          </div>
          <button
            type="button"
            className={`toggle ${settings.highlights ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.highlights}
            disabled={busy || settings.correctionMode === 'direct'}
            onClick={() => void patchSettings({ highlights: !settings.highlights })}
          >
            <span className="knob" />
            <span className="label">{settings.highlights ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </section>

      <section className="panel" aria-label="Recent corrections">
        <div className="row">
          <div>
            <h2>Recent</h2>
            {history.length > 0 ? (
              <p className="muted hist-count">
                Last {history.length} {history.length === 1 ? 'correction' : 'corrections'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="link"
            disabled={busy || history.length === 0}
            onClick={() => void onClearHistory()}
          >
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="muted empty">No corrections yet</p>
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
        <a
          className="kofi"
          href={PRODUCT.KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="cup" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 8h13v5.2A4.8 4.8 0 0 1 12.2 18H8.8A4.8 4.8 0 0 1 4 13.2V8Z"
                fill="currentColor"
                opacity="0.18"
              />
              <path
                d="M4 8h13v5.2A4.8 4.8 0 0 1 12.2 18H8.8A4.8 4.8 0 0 1 4 13.2V8Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M17 9.2h1.6A2.4 2.4 0 0 1 21 11.6 2.4 2.4 0 0 1 18.6 14H17"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M8 4.5c.4.8.4 1.5 0 2.2M11 4.2c.5.9.5 1.7 0 2.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Buy me a coffee
        </a>
      </footer>

      <style>{css}</style>
    </main>
  );
}

const css = `
.shell { display: flex; flex-direction: column; gap: 12px; }
.header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.brand { display: flex; gap: 10px; align-items: center; }
.logo {
  width: 36px; height: 36px; border-radius: 10px;
  display: grid; place-items: center; color: white; font-weight: 700;
  background: linear-gradient(145deg, #0f766e, #115e59);
  box-shadow: 0 8px 18px rgba(15,118,110,0.28);
}
h1 { margin: 0; font-size: 16px; letter-spacing: -0.02em; }
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
  box-shadow: 0 10px 30px rgba(20,32,28,0.04);
}
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mode-lead { margin-top: 4px; }
.mode-switch { display: grid; gap: 8px; margin-top: 10px; }
.mode-option {
  display: grid;
  gap: 2px;
  text-align: left;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  color: var(--ink);
  transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
}
.mode-option:hover:not(:disabled) { border-color: rgba(15, 118, 110, 0.35); }
.mode-option.active {
  border-color: rgba(15, 118, 110, 0.55);
  background: rgba(15, 118, 110, 0.06);
  box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.12);
}
.mode-option:disabled { opacity: 0.55; cursor: not-allowed; }
.mode-title { font-size: 13px; font-weight: 650; }
.mode-desc { font-size: 11.5px; color: var(--muted); line-height: 1.35; }
.ghost, .link {
  border: 1px solid var(--line);
  background: white;
  border-radius: 999px;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--ink);
}
.link { border: none; background: transparent; color: var(--accent); padding: 0; font-size: 12px; }
.ghost:disabled, .link:disabled, .toggle:disabled { opacity: 0.5; cursor: not-allowed; }
.toggle {
  position: relative;
  width: 64px; height: 32px; border-radius: 999px; border: none;
  background: #d7ded9; cursor: pointer; padding: 0;
}
.toggle.on { background: var(--accent); }
.knob {
  position: absolute; top: 3px; left: 3px; width: 26px; height: 26px;
  border-radius: 50%; background: white;
  transition: transform 140ms ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.toggle.on .knob { transform: translateX(32px); }
.label {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 10px; font-weight: 700; color: white; padding-left: 18px;
}
.toggle:not(.on) .label { color: #374151; padding-left: 0; padding-right: 18px; }
.history { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 0; max-height: 320px; overflow: auto; }
.history li {
  border-top: 1px solid var(--line);
  padding: 10px 0;
}
.history li:first-child { border-top: none; padding-top: 0; }
.history li:last-child { padding-bottom: 0; }
.hist-count { margin-top: 2px; }
.hist-entry { display: grid; gap: 6px; }
.hist-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
}
.hist-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.hist-badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: var(--muted);
  background: #f3f4f6;
  border-radius: 999px;
  padding: 2px 7px;
}
.hist-badge.edits {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.1);
}
.hist-same .hist-text { color: var(--muted); font-weight: 500; }
.hist-was {
  font-size: 11px;
  color: var(--muted);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.hist-mark {
  border-radius: 3px;
  padding: 0 1px;
  font-weight: 650;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.hist-mark.wrong {
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
  opacity: 0.9;
}
.hist-mark.wrong.spelling {
  color: #be123c;
  background: rgba(244, 63, 94, 0.12);
}
.hist-mark.wrong.grammar {
  color: #a16207;
  background: rgba(202, 138, 4, 0.14);
}
.hist-mark.wrong.wording {
  color: #3730a3;
  background: rgba(99, 102, 241, 0.1);
}
.hist-mark.fix.spelling {
  color: #be123c;
  background: rgba(244, 63, 94, 0.14);
}
.hist-mark.fix.grammar {
  color: #a16207;
  background: rgba(202, 138, 4, 0.18);
}
.hist-mark.fix.wording {
  color: #3730a3;
  background: rgba(99, 102, 241, 0.14);
}
.orig, .corr, .arrow { margin: 0; font-size: 12px; line-height: 1.35; }
.orig { color: var(--muted); }
.corr { color: var(--ink); font-weight: 560; }
.arrow { color: var(--accent); margin: 2px 0; }
.empty { margin-top: 8px; }
.consent-copy { margin: 8px 0 0; font-size: 13px; line-height: 1.45; color: var(--ink); }
.consent-list { margin: 10px 0 0; padding-left: 18px; font-size: 12px; color: var(--muted); line-height: 1.5; }
.policy-link { display: inline-block; margin-top: 10px; color: var(--accent); font-size: 12px; }
.agree {
  display: block; width: 100%; margin-top: 14px; min-height: 40px;
  border: none; border-radius: 12px; cursor: pointer;
  background: var(--accent); color: white; font-weight: 650;
}
.agree:disabled { opacity: 0.5; cursor: not-allowed; }
.support { display: flex; flex-direction: column; gap: 10px; padding-top: 2px; }
.legal { display: flex; justify-content: center; gap: 14px; }
.legal a { color: var(--muted); font-size: 11px; text-decoration: none; }
.legal a:hover { color: var(--accent); }
.kofi {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(180, 83, 9, 0.16);
  background: linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%);
  color: #9a3412;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-decoration: none;
  box-shadow: 0 6px 16px rgba(154, 52, 18, 0.08);
  transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
}
.kofi:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(154, 52, 18, 0.12);
  background: linear-gradient(180deg, #fffbeb 0%, #fed7aa 100%);
}
.kofi:focus-visible {
  outline: 2px solid #c2410c;
  outline-offset: 2px;
}
.cup { display: grid; place-items: center; color: #c2410c; }
`;
