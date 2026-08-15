# Chrome Web Store submission

Operator: **Zaixos**  
Product site: https://writing.zaixos.com  
API: https://writing-api.zaixos.com  
Support: support@zaixos.com  
Hello: hello@zaixos.com  
Privacy policy URL (paste this in the dashboard): **https://writing.zaixos.com/privacy**

Do not submit until:

1. `writing.zaixos.com` is live on HTTPS with `/privacy` and `/terms`.
2. `writing-api.zaixos.com` is live on HTTPS and `/health` works.
3. You have replaced the “Add to Chrome” link on the landing page with your real store URL after listing.

## Package

```bash
npm run build
npm run pack:store
```

Upload `store/english-writing-assistant.zip`. Source maps are excluded.

## Listing copy

**Name:** English Writing Assistant

**Short description (132 characters max):**  
Inline English spelling and grammar corrections that sit under the field you are already typing in.

**Category:** Productivity

**Language:** English

**Detailed description:**

```
English Writing Assistant helps you fix English spelling, grammar, and obvious wording while you type on ordinary websites.

It does not open a floating window. A compact correction line appears under the text field. Click the line to apply.

How it works
• Type in a textarea, text input, or contenteditable field
• Pause briefly (faster after a sentence ends)
• Review the suggestion and click to apply

Privacy
• You must agree in the popup before any writing is sent
• Text is sent over HTTPS only to generate a correction
• The model API key never ships inside the extension
• Password fields and code editors are ignored
• Up to 20 recent pairs stay on your device; clear them anytime

The assistant is built for English. Non-English writing is skipped.

Support: support@zaixos.com
Privacy: https://writing.zaixos.com/privacy
Website: https://writing.zaixos.com
```

## Privacy practices tab (match the policy)

Check **yes** for:

- User activity — website content / user-generated content (the text they type, after consent)
- Website content (content script reads the active writing field)

Check **no** unless you later add them:

- Personally identifiable information collected as a product feature (we do not ask for name/email in the extension)
- Health, financial, authentication, location, web history

**Why:** to generate English corrections.

**Used to determine creditworthiness:** No  
**Sold to third parties:** No  
**Used for purposes unrelated to the single purpose:** No

**Transferred to third parties:** Yes — Groq, solely to produce the correction.

**Privacy policy URL:** https://writing.zaixos.com/privacy

## Permission justifications

**storage**  
Saves on/off, highlight preference, consent, and local correction history.

**https://writing-api.zaixos.com/***  
Sends the current English segment over HTTPS so the hosted backend can call the language model. No other hosts are required.

**Content scripts on http://*/* and https://*/***  
A writing assistant must run on the page the user is typing on. The script only attaches to supported text fields. It does not scrape the rest of the page for advertising.

## Screenshots

Chrome requires at least one 1280×800 or 640×400 screenshot.

Capture from a clean Chrome profile with the packed extension:

1. Popup consent screen  
2. Popup after agree (Active + Recent)  
3. Fixture or Gmail-like textarea with the inline correction row  
4. Landing page at writing.zaixos.com  

128×128 icon is already in the package.

## After you create the listing

1. Copy the store URL.
2. Replace `https://chromewebstore.google.com/` in `site/index.html` with that URL.
3. Redeploy the site.

## DNS reminder

| Host | Purpose |
|------|---------|
| writing.zaixos.com | Landing, privacy, terms |
| writing-api.zaixos.com | Correction API (backend) |
