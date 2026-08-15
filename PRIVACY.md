# Privacy

The public policy for Chrome Web Store review is:

**https://writing.zaixos.com/privacy**

This file is a short developer summary. The website policy is the source of truth.

- After in-popup consent, users paste their own Groq API key. Correction text is sent over HTTPS to Groq (`api.groq.com`) using that key. The key is stored only in `chrome.storage.local` on the device (not synced).
- Developers may optionally use a local/hosted Zaixos backend instead; that path also forwards text to Groq.
- Settings and recent correction history stay in Chrome storage.
- Contact: support@zaixos.com and hello@zaixos.com.
