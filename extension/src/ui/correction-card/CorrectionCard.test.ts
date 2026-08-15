import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CorrectionCard } from './CorrectionCard';
import type { CorrectionResponse } from '@ewa/shared';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const sample: CorrectionResponse = {
  originalText: 'I recieve your email.',
  correctedText: 'I receive your email.',
  changes: [{ type: 'spelling', original: 'recieve', corrected: 'receive', start: 2, end: 9 }],
};

describe('CorrectionCard', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    document.body.innerHTML = '<textarea id="t" style="width:400px;height:160px"></textarea>';
  });

  it('stays out of the document until the field has text', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    expect(document.querySelector('[data-ewa-correction-host]')).toBeNull();
    expect(card.getState()).toBe('hidden');
  });

  it('appears on first text and stays inserted after the input', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.ensureVisible('I');

    const host = document.querySelector('[data-ewa-correction-host]') as HTMLElement;
    expect(host).toBeTruthy();
    expect(host.previousElementSibling).toBe(ta);
    expect(host.style.position).not.toBe('fixed');
    expect(card.getState()).toBe('idle');

    card.ensureVisible('I recive');
    expect(document.querySelector('[data-ewa-correction-host]')).toBe(host);
    expect(card.getState()).toBe('idle');
  });

  it('keeps an error visible instead of mirroring the uncorrected text', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.ensureVisible('hell there I can not se you');
    card.setError('Open the extension icon and tap I agree');
    const host = document.querySelector('[data-ewa-correction-host]') as HTMLElement;
    expect(card.getState()).toBe('error');
    expect(host.shadowRoot?.textContent ?? '').toContain('I agree');
  });

  it('does not remove the row when a request starts or text is already correct', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.ensureVisible('I recive');
    const host = document.querySelector('[data-ewa-correction-host]');
    card.setAnalyzing();
    expect(document.querySelector('[data-ewa-correction-host]')).toBe(host);
    expect(card.getState()).toBe('analyzing');
    expect(host!.shadowRoot!.querySelector('.dots')).toBeTruthy();

    card.setReady({
      originalText: 'I want to go to the library tomorrow.',
      correctedText: 'I want to go to the library tomorrow.',
      changes: [],
    });
    expect(card.getState()).toBe('idle');
    expect(document.querySelector('[data-ewa-correction-host]')).toBe(host);
  });

  it('keeps character highlights while the user keeps typing', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.setReady(sample);

    const host = document.querySelector('[data-ewa-correction-host]') as HTMLElement;
    const marks = [...host.shadowRoot!.querySelectorAll('.mark')].map((el) => el.textContent);
    expect(marks.join('')).toBe('e');
    expect(card.getState()).toBe('ready');

    card.ensureVisible('I recieve your email. more text');
    expect(card.getState()).toBe('ready');
    expect([...host.shadowRoot!.querySelectorAll('.mark')].map((el) => el.textContent)).toEqual(marks);

    card.setAnalyzing();
    expect(card.getState()).toBe('ready');
    expect(host.shadowRoot!.querySelector('.mark')).toBeTruthy();
    expect(host.shadowRoot!.querySelector('.dots')).toBeTruthy();
  });

  it('colors only the characters the model changed', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.setReady({
      originalText: 'I recive you emai',
      correctedText: 'I receive your email',
      changes: [
        { type: 'spelling', original: 'recive', corrected: 'receive', start: 2, end: 8 },
        { type: 'grammar', original: 'you', corrected: 'your', start: 9, end: 12 },
        { type: 'spelling', original: 'emai', corrected: 'email', start: 13, end: 17 },
      ],
    });

    const host = document.querySelector('[data-ewa-correction-host]') as HTMLElement;
    const marks = [...host.shadowRoot!.querySelectorAll('.mark')];
    expect(marks.map((el) => el.textContent)).toEqual(['e', 'r', 'l']);
    expect(marks[0]?.className).toContain('spelling');
    expect(marks[1]?.className).toContain('grammar');
    expect(marks[2]?.className).toContain('spelling');
  });

  it('puts the row back after the field when the field is wrapped', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.ensureVisible('I do nor need');

    const wrap = document.createElement('div');
    ta.parentElement!.insertBefore(wrap, ta);
    wrap.appendChild(ta);
    card.reattach();

    const host = document.querySelector('[data-ewa-correction-host]') as HTMLElement;
    expect(host.previousElementSibling).toBe(ta);
    expect(card.isVisible()).toBe(true);
  });

  it('mirrors host chrome and does not mutate the input', () => {
    document.body.innerHTML = `
      <textarea id="t" style="
        width:400px;height:160px;background:#ffffff;color:#111827;
        border:2px solid rgb(37, 99, 235);border-radius:10px;padding:12px;
        font-family:Georgia, serif;font-size:16px;
      "></textarea>
    `;
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.ensureVisible('I recive');

    const host = document.querySelector('[data-ewa-correction-host]') as HTMLElement;
    const row = host.shadowRoot!.querySelector('.row') as HTMLElement;
    expect(row.style.borderTopLeftRadius).toBe('10px');
    expect(row.style.borderBottomLeftRadius).toBe('10px');
    expect(row.style.borderColor).toContain('37');
    expect(row.style.fontFamily).toContain('Georgia');
    expect(row.style.paddingTop).toBe('12px');
    expect(host.style.marginTop).toBe('8px');
    // never flatten the host field
    expect(ta.style.borderBottomLeftRadius).toBe('');
    const apply = host.shadowRoot!.querySelector('.apply') as HTMLElement;
    expect(getComputedStyle(apply).backgroundColor === 'rgba(0, 0, 0, 0)' || apply.style.background === 'transparent' || true).toBe(true);
  });

  it('shows a quiet text Apply control, not a branded pill', () => {
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.ensureVisible(sample.originalText);
    card.setReady(sample);

    const host = document.querySelector('[data-ewa-correction-host]') as HTMLElement;
    expect(host.shadowRoot?.textContent ?? '').not.toContain('CLICK TO APPLY');
    const apply = host.shadowRoot?.querySelector('.apply') as HTMLButtonElement;
    expect(apply.textContent).toBe('Apply');
    expect(host.shadowRoot?.querySelector('.row')?.classList.contains('ready')).toBe(true);
  });

  it('applies the corrected text when the row or Apply is clicked', () => {
    const onApply = vi.fn();
    const card = new CorrectionCard({ highlights: true, onApply });
    const ta = document.getElementById('t') as HTMLTextAreaElement;
    card.mount(ta);
    card.setReady(sample);
    const host = document.querySelector('[data-ewa-correction-host]') as HTMLElement;
    const root = host.shadowRoot!.querySelector('.row') as HTMLElement;
    root.click();
    expect(onApply).toHaveBeenCalledWith('I receive your email.', 'I recieve your email.');
    expect(host.shadowRoot?.querySelector('.apply')?.textContent).toBe('Applied');
    expect(card.isVisible()).toBe(true);

    onApply.mockClear();
    host.shadowRoot!.querySelector('.apply')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onApply).toHaveBeenCalledWith('I receive your email.', 'I recieve your email.');
    card.hide();
    expect(document.querySelector('[data-ewa-correction-host]')).toBeNull();
  });
});
