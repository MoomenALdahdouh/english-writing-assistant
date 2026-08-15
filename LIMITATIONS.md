# Limitations

## Direct edit sync

In **direct edit** mode, a late API response never replaces the whole field. The extension merges the fix into the original snapshot only and keeps any text typed afterward. If the user edited inside that snapshot, the stale result is skipped.

- **Suggestion box** (default): corrections appear in a row under the field with optional color highlights; click to apply.
- **Direct edit**: the extension rewrites the field in place after you pause typing. No suggestion box and no colored markup in the page.

If the field has more than **250 characters** (typical large paste), the extension does **not** show suggestions or call the API at all — the user’s text is left untouched.

Shorter drafts may still send up to ~2000 characters of trailing context to the model when needed. That keeps latency and cost bounded while focusing on what the user is writing now.

## Iframes

- **Same-origin** frames: content script runs with `all_frames: true`.
- **Cross-origin** frames: Chrome blocks injection. The extension cannot read or correct those editors.

## Site notes (honest)


| Site                                            | Expectation                                                     |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Generic textarea / text input / contenteditable | Supported                                                       |
| GitHub comment/PR textareas                     | Generally supported                                             |
| Reddit textareas                                | Generally supported                                             |
| LinkedIn / X compose                            | Best-effort contenteditable; complex editors may partially work |
| Gmail compose                                   | Often inside complex editors / iframes — may be limited         |
| ChatGPT input                                   | Best-effort; UI changes can break targeting                     |
| Google Docs                                     | Generally **unsupported** (custom canvas/iframe editor)         |
| Monaco / CodeMirror / Ace                       | Explicitly ignored                                              |




## IME composition

Correction is deferred while composition is active (`compositionstart` / `compositionend`).

## Backend required

Store builds call `https://writing-api.zaixos.com`. Until that host is deployed with `GROQ_API_KEY`, corrections fail softly. Typing on the host page is never blocked. You must accept the in-popup privacy disclosure before any text is sent.