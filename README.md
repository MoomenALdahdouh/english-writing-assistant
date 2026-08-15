# English Writing Assistant

Chrome extension that suggests English spelling and grammar fixes while you type.  
Each person uses **their own free [Groq API key](https://console.groq.com/keys)** — nothing complicated to host.

Site & privacy: [https://writing.zaixos.com](https://writing.zaixos.com)

## Install from GitHub (easiest)

You need [Node.js 20+](https://nodejs.org/) once, to build the extension.

```bash
git clone https://github.com/MoomenALdahdouh/english-writing-assistant.git
cd english-writing-assistant
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** → choose the folder `extension/dist`
4. Click the extension icon → **Continue** → paste your Groq API key → **Save key**

Get a free key: [console.groq.com/keys](https://console.groq.com/keys) (create an account → API Keys → Create).

That’s it. Type in any normal text field on the web; corrections appear after a short pause.

### After you pull updates

```bash
git pull
npm install
npm run build
```

Then click **Reload** on the extension card in `chrome://extensions`, and refresh any open tabs.

## Using the popup

| Step | What to do |
|------|------------|
| Consent | Tap **Continue** once |
| API key | Paste `gsk_…` and **Save key** (stored only on your device) |
| Mode | **Suggestion box** (click to apply) or **Direct edit** (fixes as you type) |
| Pause | Use **Pause** anytime |

If you see “add your free Groq API key”, open the popup and save a key.

## Optional: local backend (developers)

Only needed if you are developing the API without a user key. Normal users skip this.

```bash
cp backend/.env.example backend/.env
# set GROQ_API_KEY in backend/.env
npm run dev:backend
```

Unpacked builds can talk to `http://127.0.0.1:8787` (or Herd at `https://writing-api.test`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build shared + extension (what you load in Chrome) |
| `npm run dev:extension` | Watch rebuild while editing the extension |
| `npm run dev:backend` | Local API on :8787 (optional) |
| `npm run test` | Unit tests |
| `npm run pack:store` | Zip `extension/dist` for the Chrome Web Store |

Store notes: [STORE.md](STORE.md) · Privacy notes: [PRIVACY.md](PRIVACY.md)

## Security note

Never commit a Groq key. Revoke any key that was pasted into chat or pushed to git.
