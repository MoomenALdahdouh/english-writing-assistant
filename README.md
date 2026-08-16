<div align="center">
  <img src="extension/public/icons/icon-128.png" alt="English Writing Assistant" width="96" height="96" />

  <h1>English Writing Assistant</h1>

  <p>Chrome extension for inline English spelling and grammar corrections.</p>

  <p>
    <img alt="release" src="https://img.shields.io/badge/release-v1.3.13-0ea5e9" />
    <img alt="Chrome" src="https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white" />
    <img alt="Node" src="https://img.shields.io/badge/Node-20+-111827?logo=nodedotjs&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
    <img alt="BYOK" src="https://img.shields.io/badge/BYOK-Groq_API-F55036" />
  </p>
</div>

---

## Overview

English Writing Assistant is a Manifest V3 Chrome extension that suggests spelling and grammar fixes while you type in web text fields. The UI stays light; corrections are produced by [Groq](https://console.groq.com/keys) using **your** free API key. No shared backend is required for normal use, and the key stays on the device in `chrome.storage.local`.

Site: [writing.zaixos.com](https://writing.zaixos.com) · Privacy: [writing.zaixos.com/privacy](https://writing.zaixos.com/privacy)

---

## Features

- Suggestion box or direct in-field edits
- Fast default model (`llama-3.1-8b-instant`)
- Recent correction history in the popup
- Passwords and code-like fields are ignored
- Optional local Node backend for development

---

## Installation

Requires [Node.js 20+](https://nodejs.org/).

```bash
git clone https://github.com/MoomenALdahdouh/english-writing-assistant.git
cd english-writing-assistant
npm install
npm run build
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/dist`
4. Open the popup → **Continue** → paste your Groq API key → **Save key**

Free key: [console.groq.com/keys](https://console.groq.com/keys)

After pulling updates:

```bash
git pull
npm install
npm run build
```

Then click **Reload** on the extension card and refresh open tabs.

---

## Usage

| Control | Purpose |
|---------|---------|
| **Continue** | One-time consent |
| **Groq API key** | Required — stored only on this device |
| **Suggestion box** | Show fixes under the field (click to apply) |
| **Direct edit** | Rewrite the field as you type |
| **Pause** | Temporarily disable corrections |

Type in a normal text field on any site. Corrections appear after a short pause.

---

## Project layout

```text
english-writing-assistant/
├── extension/          # Chrome MV3 extension (content, background, popup)
├── backend/            # Optional local API (developers)
├── packages/shared/    # Shared types, defaults, correction helpers
└── site/               # Public website / privacy pages
```

---

## Development

```bash
# Watch-rebuild the extension
npm run dev:extension

# Optional local backend (no user key in the popup)
cp backend/.env.example backend/.env
# set GROQ_API_KEY=...
npm run dev:backend
```

Unpacked builds can use `http://127.0.0.1:8787` or Herd at `https://writing-api.test`.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build shared, backend, and extension |
| `npm run dev:extension` | Vite watch build for the extension |
| `npm run dev:backend` | Local API on port `8787` |
| `npm run test` | Unit tests |
| `npm run typecheck` | TypeScript checks |
| `npm run pack:store` | Zip `extension/dist` for Chrome Web Store |

---

## Privacy & security

- Your Groq key is sent only as the `Authorization` header to Groq.
- Do not commit API keys. Revoke any key that was pasted into chat or pushed to git.
- Details: [PRIVACY.md](PRIVACY.md) · store notes: [STORE.md](STORE.md)

---

## Links

- [Website](https://writing.zaixos.com)
- [Privacy policy](https://writing.zaixos.com/privacy)
- [Groq API keys](https://console.groq.com/keys)
