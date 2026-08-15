import { DEFAULTS, type CorrectionResponse } from '@ewa/shared';
import { findEditableFromTarget, type InputAdapter } from '../adapters';
import { endsWithSentenceBoundary, endsWithWordBoundary, IntelligentDebouncer } from './debounce';
import { extractWritingContext } from './segment';
import { applyInstantSpelling } from './instantSpell';
import { isEligibleForCorrection, shouldShowEnglishAssistant } from '../language/detect';
import { CorrectionCard } from '../ui/correction-card/CorrectionCard';
import { canMergeCorrection, mergeCorrectionIntoField } from './mergeCorrection';
import { createLogger } from '../shared/logger';
import type { CorrectResultMessage, SettingsPayload } from '../shared/messages';

const log = createLogger('content');

function isExtensionContextInvalidated(err?: unknown): boolean {
  if (!chrome.runtime?.id) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /Extension context invalidated/i.test(msg);
}

type Session = {
  adapter: InputAdapter;
  unsubscribe: () => void;
  card: CorrectionCard;
  debouncer: IntelligentDebouncer;
  lastSentText: string;
  lastCorrectedFor: string;
  composing: boolean;
  requestIds: Set<string>;
  requestSeq: number;
  lastAppliedSeq: number;
  generation: number;
};

let settings: SettingsPayload = {
  enabled: DEFAULTS.ENABLED_DEFAULT,
  highlights: DEFAULTS.HIGHLIGHTS_DEFAULT,
  correctionMode: DEFAULTS.CORRECTION_MODE_DEFAULT,
  backendUrl: DEFAULTS.BACKEND_URL,
  consentAccepted: false,
};

let active: Session | null = null;

function isBoxMode(): boolean {
  return settings.correctionMode !== 'direct';
}

function debounceOptionsForMode() {
  if (!isBoxMode()) {
    return {
      defaultMs: DEFAULTS.DIRECT_DEBOUNCE_MS,
      wordBoundaryMs: DEFAULTS.DIRECT_WORD_BOUNDARY_DEBOUNCE_MS,
      sentenceBoundaryMs: DEFAULTS.DIRECT_SENTENCE_BOUNDARY_DEBOUNCE_MS,
    };
  }
  return {
    defaultMs: DEFAULTS.DEBOUNCE_MS,
    wordBoundaryMs: DEFAULTS.WORD_BOUNDARY_DEBOUNCE_MS,
    sentenceBoundaryMs: DEFAULTS.SENTENCE_BOUNDARY_DEBOUNCE_MS,
  };
}

/** Instant local typo fixes in direct mode (no API wait). */
function maybeApplyInstantSpelling(session: Session, text: string): string {
  if (isBoxMode()) return text;
  if (!endsWithWordBoundary(text) && !endsWithSentenceBoundary(text)) return text;
  const fixed = applyInstantSpelling(text);
  if (fixed === text) return text;
  session.adapter.setText(fixed);
  session.lastCorrectedFor = truncateSegment(fixed);
  session.lastSentText = session.lastCorrectedFor;
  return fixed;
}

async function refreshSettings(): Promise<void> {
  try {
    if (isExtensionContextInvalidated()) return;
    const next = (await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })) as SettingsPayload;
    if (next && typeof next.enabled === 'boolean') {
      settings = {
        ...next,
        consentAccepted: next.consentAccepted === true,
        correctionMode: next.correctionMode === 'direct' ? 'direct' : 'box',
      };
    }
    if (active) {
      active.debouncer.setOptions(debounceOptionsForMode());
      active.card.setHighlights(settings.highlights);
      if (!settings.enabled) {
        teardownSession();
      } else if (settings.consentAccepted) {
        const text = active.adapter.getText();
        if (!isBoxMode()) {
          active.card.hide();
        }
        if (text.trim() && shouldShowEnglishAssistant(text)) {
          if (isBoxMode()) syncRowVisibility(active, text);
          active.generation = active.debouncer.schedule(text);
        } else {
          active.card.hide();
        }
      }
    }
  } catch (err) {
    if (isExtensionContextInvalidated(err)) {
      log.info('extension_context_invalidated');
      return;
    }
    log.warn('settings_failed', err);
  }
}

function truncateSegment(text: string): string {
  return extractWritingContext(text);
}

function cancelInflight(session: Session): void {
  if (isExtensionContextInvalidated()) {
    session.requestIds.clear();
    return;
  }
  for (const requestId of session.requestIds) {
    void chrome.runtime.sendMessage({ type: 'CANCEL_CORRECT', requestId });
  }
  session.requestIds.clear();
}

function resetCorrectionMemory(session: Session): void {
  session.lastSentText = '';
  session.lastCorrectedFor = '';
  session.lastAppliedSeq = 0;
}

function isResultStillRelevant(session: Session, requestedText: string, segment: string): boolean {
  const current = session.adapter.getText();
  if (!current.trim()) return false;
  // Direct mode: only apply when we can merge into the live field without clobbering
  if (!isBoxMode()) {
    return canMergeCorrection(current, segment);
  }
  return (
    current === requestedText ||
    current.startsWith(requestedText) ||
    current.startsWith(segment) ||
    truncateSegment(current) === segment
  );
}

function syncRowVisibility(session: Session, text: string): void {
  // Direct mode never shows the suggestion box
  if (!isBoxMode()) {
    session.card.hide();
    if (!text.trim() || !shouldShowEnglishAssistant(text)) {
      resetCorrectionMemory(session);
      session.debouncer.cancel();
      cancelInflight(session);
    }
    return;
  }
  if (!text.trim() || !shouldShowEnglishAssistant(text)) {
    session.card.hide();
    resetCorrectionMemory(session);
    session.debouncer.cancel();
    cancelInflight(session);
    return;
  }
  session.card.ensureVisible(text);
}

/** Hide the correction row whenever the live field is empty (send / clear / Enter). */
function syncFieldEmptyState(session: Session): void {
  const text = session.adapter.getText();
  if (!text.trim()) {
    syncRowVisibility(session, '');
  }
}

function prepareSession(adapter: InputAdapter): Session {
  const card = new CorrectionCard({
    highlights: settings.highlights,
    onApply: (corrected, original) => applyCorrection(adapter, corrected, original),
  });
  card.mount(adapter.element);

  const session: Session = {
    adapter,
    unsubscribe: () => undefined,
    card,
    debouncer: null as unknown as IntelligentDebouncer,
    lastSentText: '',
    lastCorrectedFor: '',
    composing: false,
    requestIds: new Set<string>(),
    requestSeq: 0,
    lastAppliedSeq: 0,
    generation: 0,
  };

  session.debouncer = new IntelligentDebouncer((text, generation) => {
    void requestCorrection(session, text, generation);
  }, debounceOptionsForMode());

  const onInput = () => {
    if (!settings.enabled) return;
    if (session.composing) return;
    let text = adapter.getText();
    text = maybeApplyInstantSpelling(session, text);
    syncRowVisibility(session, text);
    if (!text.trim() || !shouldShowEnglishAssistant(text)) return;
    session.generation = session.debouncer.schedule(text);
  };

  session.unsubscribe = adapter.subscribe(onInput);

  const onCompStart = () => {
    session.composing = true;
    session.debouncer.cancel();
  };
  const onCompEnd = () => {
    session.composing = false;
    onInput();
  };
  adapter.element.addEventListener('compositionstart', onCompStart);
  adapter.element.addEventListener('compositionend', onCompEnd);

  // After Enter/send, frameworks often clear the field a tick later
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    window.setTimeout(() => {
      if (active !== session) return;
      syncFieldEmptyState(session);
    }, 0);
    window.setTimeout(() => {
      if (active !== session) return;
      syncFieldEmptyState(session);
    }, 120);
    window.setTimeout(() => {
      if (active !== session) return;
      syncFieldEmptyState(session);
    }, 400);
  };
  adapter.element.addEventListener('keydown', onKeyDown);

  // Catch programmatic clears that skip input events (send button, form submit)
  const emptyWatcher = new MutationObserver(() => {
    if (active !== session) return;
    syncFieldEmptyState(session);
  });
  emptyWatcher.observe(adapter.element, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['value', 'data-value', 'aria-valuetext'],
  });

  const prevUnsub = session.unsubscribe;
  session.unsubscribe = () => {
    prevUnsub();
    adapter.element.removeEventListener('compositionstart', onCompStart);
    adapter.element.removeEventListener('compositionend', onCompEnd);
    adapter.element.removeEventListener('keydown', onKeyDown);
    emptyWatcher.disconnect();
  };

  const existing = adapter.getText();
  if (existing.trim() && shouldShowEnglishAssistant(existing)) {
    if (isBoxMode()) {
      session.card.ensureVisible(existing);
    } else {
      session.card.hide();
    }
    if (isEligibleForCorrection(truncateSegment(existing))) {
      session.generation = session.debouncer.schedule(existing);
    }
  } else {
    session.card.hide();
  }

  log.info('session_ready', adapter.kind);
  return session;
}

async function requestCorrection(session: Session, text: string, generation: number): Promise<void> {
  if (generation !== session.debouncer.currentGeneration()) return;
  if (!settings.enabled) return;
  if (session.composing) return;
  if (!settings.consentAccepted) {
    await refreshSettings();
    if (!settings.consentAccepted) {
      if (isBoxMode()) {
        session.card.setError('Open the extension icon and tap I agree');
      }
      log.warn('correct_skipped_consent');
      return;
    }
  }

  // Long pastes / long fields: never segment-correct a trailing slice
  if (!shouldShowEnglishAssistant(text)) {
    log.debug('skip_long_or_ineligible_field', text.trim().length);
    if (isBoxMode()) session.card.hide();
    resetCorrectionMemory(session);
    return;
  }

  const segment = truncateSegment(text);
  if (!isEligibleForCorrection(segment)) {
    log.debug('skip_ineligible', segment.slice(0, 40));
    if (isBoxMode()) session.card.ensureVisible(text);
    return;
  }
  if (segment === session.lastSentText && session.card.getState() === 'ready') return;
  if (segment === session.lastCorrectedFor) return;

  const seq = ++session.requestSeq;
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  session.requestIds.add(requestId);
  session.lastSentText = segment;
  if (isBoxMode()) session.card.setAnalyzing();
  const requestStarted = performance.now();
  log.info('correct_request', requestId, segment.length);

  try {
    const result = (await chrome.runtime.sendMessage({
      type: 'CORRECT',
      requestId,
      text: segment,
      fieldType: session.adapter.kind,
      previousText: text.slice(0, Math.max(0, text.length - segment.length)).slice(-200),
    })) as CorrectResultMessage;

    if (seq < session.lastAppliedSeq) return;
    if (!isResultStillRelevant(session, text, segment)) return;

    // Intentional cancel (retype / hide) — not a user-facing failure
    if (result?.aborted || result?.error === 'aborted') {
      return;
    }

    if (!result?.ok || !result.data) {
      const errCode = result?.error ?? 'unknown';
      // http_5xx from Herd usually means the local Node API is down
      const asNetwork = errCode === 'network' || /^http_5\d\d$/.test(errCode);
      log.warn('correct_result_failed', errCode);
      if (isBoxMode()) {
        const message =
          errCode === 'disabled'
            ? 'Open the extension icon and tap I agree'
            : asNetwork
              ? 'Backend unreachable — run npm run dev:backend'
              : undefined;
        session.card.setError(message);
      }
      return;
    }

    log.debug('perf', {
      requestId,
      pauseToResultMs: Math.round(performance.now() - requestStarted),
      backendMs: result.timing?.backendMs,
      model: result.timing?.model,
      chars: segment.length,
    });
    session.lastAppliedSeq = seq;
    applyResult(session, result.data, segment);
  } catch (err) {
    if (isExtensionContextInvalidated(err)) {
      log.info('extension_context_invalidated');
      if (isBoxMode()) {
        session.card.setError('Reload this page after updating the extension');
      }
      return;
    }
    log.warn('request_failed', err);
    if (isBoxMode()) session.card.setError('Extension error — reload the page');
  } finally {
    session.requestIds.delete(requestId);
  }
}

function applyResult(session: Session, data: CorrectionResponse, sourceText: string): void {
  if (!session.adapter.getText().trim()) {
    syncRowVisibility(session, '');
    return;
  }
  if (data.correctedText === data.originalText || data.correctedText === sourceText) {
    session.lastCorrectedFor = sourceText;
    if (isBoxMode() && !session.card.hasReadyCorrection()) {
      session.card.showPlain(sourceText);
    }
    log.info('no_changes');
    return;
  }
  session.lastCorrectedFor = sourceText;

  if (!isBoxMode()) {
    applyCorrection(session.adapter, data.correctedText, sourceText);
    log.info('direct_applied');
    return;
  }

  session.card.setReady({
    ...data,
    originalText: sourceText,
  });
  log.info('card_ready');
}

function applyCorrection(adapter: InputAdapter, corrected: string, source: string): void {
  const current = adapter.getText();
  const next = mergeCorrectionIntoField(current, source, corrected);
  if (next == null) {
    log.info('skip_stale_apply', { sourceLen: source.length, currentLen: current.length });
    return;
  }
  if (next === current) return;

  adapter.setText(next);
  adapter.focus();
  if (active) {
    active.lastCorrectedFor = truncateSegment(next);
    active.lastSentText = active.lastCorrectedFor;
    active.debouncer.bump();
  }
  void chrome.runtime.sendMessage({
    type: 'ADD_HISTORY',
    original: source,
    corrected,
  });
}

function teardownSession(): void {
  if (!active) return;
  cancelInflight(active);
  active.debouncer.cancel();
  active.unsubscribe();
  active.card.unmount();
  active = null;
}

function ensureSession(adapter: InputAdapter): Session | null {
  if (!settings.enabled) return null;
  if (active?.adapter.element === adapter.element) return active;
  teardownSession();
  active = prepareSession(adapter);
  return active;
}

function focusEditable(el: EventTarget | null): void {
  const adapter = findEditableFromTarget(el);
  if (!adapter) return;
  ensureSession(adapter);
}

function onFocusIn(e: FocusEvent): void {
  focusEditable(e.target);
}

function onInputCapture(e: Event): void {
  const adapter = findEditableFromTarget(e.target);
  if (!adapter) return;
  const session = ensureSession(adapter);
  if (!session || session.composing || !settings.enabled) return;
  let text = adapter.getText();
  text = maybeApplyInstantSpelling(session, text);
  syncRowVisibility(session, text);
  if (!text.trim()) {
    session.debouncer.cancel();
    cancelInflight(session);
    return;
  }
  if (!shouldShowEnglishAssistant(text)) return;
  session.generation = session.debouncer.schedule(text);
}

function onFocusOut(e: FocusEvent): void {
  if (!active) return;
  const next = e.relatedTarget;
  if (active.card.contains(next)) return;
  if (next && findEditableFromTarget(next)?.element === active.adapter.element) return;
  if (next && findEditableFromTarget(next)) return;

  window.setTimeout(() => {
    if (!active) return;
    const field = active.adapter.element;
    const focused = document.activeElement;
    if (focused && (field === focused || field.contains(focused) || active.card.contains(focused))) {
      return;
    }
    if (active.card.isVisible() && active.card.hasReadyCorrection() && focused === field) {
      return;
    }
    if (findEditableFromTarget(focused)?.element === field) return;
    if (
      focused instanceof Element &&
      field.parentElement?.contains(focused) &&
      !findEditableFromTarget(focused)
    ) {
      return;
    }
    if (findEditableFromTarget(focused)) return;
    teardownSession();
  }, 0);
}

function observeDom(): void {
  const observer = new MutationObserver(() => {
    if (!active) return;
    if (!document.contains(active.adapter.element)) {
      teardownSession();
      return;
    }
    syncFieldEmptyState(active);
    if (active.card.isVisible()) {
      active.card.reattach();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function watchSpaNavigation(): void {
  const notify = () => {
    if (active && !document.contains(active.adapter.element)) {
      teardownSession();
    }
  };
  window.addEventListener('popstate', notify);
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = (...args) => {
    origPush(...args);
    notify();
  };
  history.replaceState = (...args) => {
    origReplace(...args);
    notify();
  };
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.ewa_settings) {
    void refreshSettings();
  }
});

void refreshSettings().then(() => {
  focusEditable(document.activeElement);
});

document.addEventListener('focusin', onFocusIn, true);
document.addEventListener('focusout', onFocusOut, true);
document.addEventListener('input', onInputCapture, true);
observeDom();
watchSpaNavigation();

log.info('content_ready', location.href);
