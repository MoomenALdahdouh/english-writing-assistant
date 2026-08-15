# English Writing Assistant

Chrome Manifest V3 extension that shows an inline English correction row while you type on the web. Corrections are produced by a Zaixos backend that calls Groq — the API key never ships inside the extension.

Public site and privacy policy: [https://writing.zaixos.com](https://writing.zaixos.com)  
Store submission notes: [STORE.md](STORE.md)

## Setup

```bash
npm install
cp backend/.env.example backend/.env
# put GROQ_API_KEY in backend/.env
```

## Configure Groq

Edit `backend/.env`:

```
GROQ_API_KEY=your_key_here
GROQ_MODEL=openai/gpt-oss-120b
PORT=8787
```

## Start backend (Laravel Herd)

This repo’s API is a Node server on port `8787`. Herd proxies it at **`https://writing-api.test`** (same pattern as your other apps).

```bash
# one-time (already done if writing-api appears in `herd proxies`)
herd proxy writing-api http://127.0.0.1:8787 --secure

# keep the Node API running while developing
npm run dev:backend
```

Health checks:

- Direct: `GET http://127.0.0.1:8787/health`
- Via Herd: `GET https://writing-api.test/health`

Unpacked extension builds use `https://writing-api.test` automatically and fall back to `http://127.0.0.1:8787`.

## Start backend (without Herd)

```bash
npm run dev:backend
```

Health check: `GET http://localhost:8787/health`

## Build extension

```bash
npm run build
```

Load unpacked in Chrome:

1. Open `chrome://extensions`
2. Enable Developer mode
3. **Load unpacked** → select `extension/dist`

For development with HMR:

```bash
npm run dev:extension
```

Then load the path Vite/CRX prints (usually `extension/dist`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:backend` | Run API on :8787 |
| `npm run dev:extension` | Vite + CRX watch build |
| `npm run build` | Build shared, backend, extension |
| `npm run test` | Unit/integration tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run secret-scan` | Ensure no Groq secrets in client bundles |
| `npm run pack:store` | Zip `extension/dist` for the Chrome Web Store |

## Privacy

Canonical policy: [https://writing.zaixos.com/privacy](https://writing.zaixos.com/privacy). Notes: [PRIVACY.md](PRIVACY.md), [LIMITATIONS.md](LIMITATIONS.md).

## Rotate exposed keys

If a Groq key was ever pasted into chat or committed, revoke it in the Groq console and create a new one.
