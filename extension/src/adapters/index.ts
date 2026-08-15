export type SelectionRange = { start: number; end: number };

export interface InputAdapter {
  readonly element: HTMLElement;
  readonly kind: 'textarea' | 'text' | 'contenteditable';
  getText(): string;
  setText(text: string): void;
  getSelection(): SelectionRange;
  setSelection(range: SelectionRange): void;
  focus(): void;
  getRect(): DOMRect;
  isDisabled(): boolean;
  subscribe(listener: () => void): () => void;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function mapCursorAfterReplace(oldText: string, newText: string, cursor: number): number {
  if (oldText === newText) return cursor;
  if (cursor >= oldText.length) return newText.length;
  // Prefer end when lengths diverge significantly
  if (Math.abs(oldText.length - newText.length) > Math.max(12, oldText.length * 0.3)) {
    return newText.length;
  }
  const ratio = oldText.length === 0 ? 1 : cursor / oldText.length;
  return Math.min(newText.length, Math.round(newText.length * ratio));
}

export class TextareaAdapter implements InputAdapter {
  readonly kind = 'textarea' as const;
  constructor(readonly element: HTMLTextAreaElement) {}

  getText(): string {
    return this.element.value;
  }

  setText(text: string): void {
    const sel = this.getSelection();
    const old = this.element.value;
    setNativeValue(this.element, text);
    const mapped = mapCursorAfterReplace(old, text, sel.start);
    this.setSelection({ start: mapped, end: mapped });
  }

  getSelection(): SelectionRange {
    return {
      start: this.element.selectionStart ?? 0,
      end: this.element.selectionEnd ?? 0,
    };
  }

  setSelection(range: SelectionRange): void {
    this.element.setSelectionRange(range.start, range.end);
  }

  focus(): void {
    this.element.focus();
  }

  getRect(): DOMRect {
    return this.element.getBoundingClientRect();
  }

  isDisabled(): boolean {
    return this.element.disabled || this.element.readOnly;
  }

  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    this.element.addEventListener('input', handler);
    this.element.addEventListener('change', handler);
    this.element.addEventListener('keyup', handler);
    this.element.addEventListener('compositionend', handler);
    return () => {
      this.element.removeEventListener('input', handler);
      this.element.removeEventListener('change', handler);
      this.element.removeEventListener('keyup', handler);
      this.element.removeEventListener('compositionend', handler);
    };
  }
}

export class TextInputAdapter implements InputAdapter {
  readonly kind = 'text' as const;
  constructor(readonly element: HTMLInputElement) {}

  getText(): string {
    return this.element.value;
  }

  setText(text: string): void {
    const sel = this.getSelection();
    const old = this.element.value;
    setNativeValue(this.element, text);
    const mapped = mapCursorAfterReplace(old, text, sel.start);
    this.setSelection({ start: mapped, end: mapped });
  }

  getSelection(): SelectionRange {
    return {
      start: this.element.selectionStart ?? 0,
      end: this.element.selectionEnd ?? 0,
    };
  }

  setSelection(range: SelectionRange): void {
    this.element.setSelectionRange(range.start, range.end);
  }

  focus(): void {
    this.element.focus();
  }

  getRect(): DOMRect {
    return this.element.getBoundingClientRect();
  }

  isDisabled(): boolean {
    return this.element.disabled || this.element.readOnly;
  }

  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    this.element.addEventListener('input', handler);
    this.element.addEventListener('change', handler);
    this.element.addEventListener('keyup', handler);
    this.element.addEventListener('compositionend', handler);
    return () => {
      this.element.removeEventListener('input', handler);
      this.element.removeEventListener('change', handler);
      this.element.removeEventListener('keyup', handler);
      this.element.removeEventListener('compositionend', handler);
    };
  }
}

function getContentEditableText(el: HTMLElement): string {
  const raw = el.innerText ?? el.textContent ?? '';
  return raw.replace(/\u00a0/g, ' ');
}

function getContentEditableSelection(el: HTMLElement): SelectionRange {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };
  const range = sel.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return { start: 0, end: 0 };

  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  return { start, end };
}

function setContentEditableSelection(el: HTMLElement, range: SelectionRange): void {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let current = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const next = current + node.data.length;
    if (!startNode && range.start <= next) {
      startNode = node;
      startOffset = Math.max(0, range.start - current);
    }
    if (!endNode && range.end <= next) {
      endNode = node;
      endOffset = Math.max(0, range.end - current);
      break;
    }
    current = next;
    node = walker.nextNode() as Text | null;
  }
  if (!startNode) return;
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.setStart(startNode, Math.min(startOffset, startNode.data.length));
  r.setEnd(endNode ?? startNode, Math.min(endOffset, (endNode ?? startNode).data.length));
  sel.removeAllRanges();
  sel.addRange(r);
}

export class ContentEditableAdapter implements InputAdapter {
  readonly kind = 'contenteditable' as const;
  constructor(readonly element: HTMLElement) {}

  getText(): string {
    return getContentEditableText(this.element);
  }

  setText(text: string): void {
    const old = this.getText();
    const sel = this.getSelection();
    this.element.focus();
    // Prefer execCommand for framework compatibility when available
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(this.element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    let ok = false;
    try {
      ok =
        typeof document.execCommand === 'function' &&
        document.execCommand('insertText', false, text);
    } catch {
      ok = false;
    }
    if (!ok) {
      this.element.textContent = text;
      this.element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    }
    const mapped = mapCursorAfterReplace(old, text, sel.start);
    this.setSelection({ start: mapped, end: mapped });
  }

  getSelection(): SelectionRange {
    return getContentEditableSelection(this.element);
  }

  setSelection(range: SelectionRange): void {
    setContentEditableSelection(this.element, range);
  }

  focus(): void {
    this.element.focus();
  }

  getRect(): DOMRect {
    return this.element.getBoundingClientRect();
  }

  isDisabled(): boolean {
    return (
      this.element.getAttribute('contenteditable') === 'false' ||
      this.element.hasAttribute('disabled') ||
      this.element.getAttribute('aria-disabled') === 'true'
    );
  }

  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    this.element.addEventListener('input', handler);
    this.element.addEventListener('keyup', handler);
    this.element.addEventListener('compositionend', handler);
    // Chat apps often clear the composer via React without a normal input event
    const mo = new MutationObserver(handler);
    mo.observe(this.element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      this.element.removeEventListener('input', handler);
      this.element.removeEventListener('keyup', handler);
      this.element.removeEventListener('compositionend', handler);
      mo.disconnect();
    };
  }
}

const IGNORED_INPUT_TYPES = new Set([
  'password',
  'email',
  'number',
  'tel',
  'url',
  'search',
  'hidden',
  'file',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'image',
  'color',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
  'range',
]);

function looksLikeCodeEditor(el: HTMLElement): boolean {
  const cls = `${el.className} ${el.getAttribute('data-mode') ?? ''}`.toLowerCase();
  return (
    cls.includes('monaco') ||
    cls.includes('codemirror') ||
    cls.includes('ace_editor') ||
    cls.includes('cm-editor') ||
    el.closest('.monaco-editor, .CodeMirror, .cm-editor, .ace_editor') !== null
  );
}

export function createAdapter(el: Element): InputAdapter | null {
  if (!(el instanceof HTMLElement)) return null;
  if (looksLikeCodeEditor(el)) return null;

  if (el instanceof HTMLTextAreaElement) {
    if (el.disabled || el.readOnly) return null;
    return new TextareaAdapter(el);
  }

  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    if (IGNORED_INPUT_TYPES.has(type)) return null;
    if (type !== 'text' && type !== '') return null;
    if (el.disabled || el.readOnly) return null;
    return new TextInputAdapter(el);
  }

  const editableAttr = el.getAttribute('contenteditable');
  if (el.isContentEditable || editableAttr === 'true' || editableAttr === '') {
    if (looksLikeCodeEditor(el)) return null;
    // Prefer the outermost editing host when nested contenteditables exist
    const host = el.closest('[contenteditable="true"], [contenteditable=""], [contenteditable]') as HTMLElement | null;
    const target = host && host.isContentEditable !== false ? host : el;
    if (looksLikeCodeEditor(target)) return null;
    return new ContentEditableAdapter(target);
  }

  return null;
}

/** Walk up from a focus/input target to a supported editable field. */
export function findEditableFromTarget(target: EventTarget | null): InputAdapter | null {
  if (!(target instanceof Element)) return null;
  let node: Element | null = target;
  while (node) {
    if (node instanceof HTMLElement && node.hasAttribute('data-ewa-correction-host')) {
      return null;
    }
    const adapter = createAdapter(node);
    if (adapter) return adapter;
    // contenteditable ancestors: children often receive focus
    if (node.parentElement?.isContentEditable || node.parentElement?.getAttribute('contenteditable') === 'true') {
      const parentAdapter = createAdapter(node.parentElement);
      if (parentAdapter) return parentAdapter;
    }
    node = node.parentElement;
  }
  return null;
}

export function isSupportedEditable(el: Element): boolean {
  return createAdapter(el) !== null;
}
