import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditableAdapter, TextInputAdapter, TextareaAdapter, createAdapter } from './index';

describe('adapters', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates textarea adapter and applies text with events', () => {
    const el = document.createElement('textarea');
    document.body.appendChild(el);
    const adapter = createAdapter(el);
    expect(adapter).toBeInstanceOf(TextareaAdapter);
    let inputCount = 0;
    el.addEventListener('input', () => inputCount++);
    adapter!.setText('I receive your email.');
    expect(el.value).toBe('I receive your email.');
    expect(inputCount).toBeGreaterThan(0);
  });

  it('creates text input adapter and ignores password', () => {
    const text = document.createElement('input');
    text.type = 'text';
    const password = document.createElement('input');
    password.type = 'password';
    document.body.append(text, password);
    expect(createAdapter(text)).toBeInstanceOf(TextInputAdapter);
    expect(createAdapter(password)).toBeNull();
  });

  it('notifies when contenteditable is cleared without an input event', async () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    el.textContent = 'hello';
    document.body.appendChild(el);
    const adapter = createAdapter(el);
    expect(adapter).toBeInstanceOf(ContentEditableAdapter);
    let calls = 0;
    adapter!.subscribe(() => {
      calls++;
    });
    el.textContent = '';
    await vi.waitFor(() => {
      expect(calls).toBeGreaterThan(0);
    });
    expect(adapter!.getText().trim()).toBe('');
  });
});
