# writing.zaixos.com

Static site for the English Writing Assistant: landing, privacy, and terms.

## DNS

Create these records on zaixos.com:

| Host | Type | Target |
|------|------|--------|
| `writing` | CNAME | your static host (Cloudflare Pages, Netlify, or Vercel) |
| `writing-api` | CNAME or A | wherever you deploy `backend/` (Fly, Render, a VPS) |

## Deploy the site

Point the Pages/Netlify/Vercel project at the `site/` folder. After the first deploy, attach the custom domain `writing.zaixos.com` and wait for HTTPS.

Clean URLs (`/privacy`, `/terms`) work on Cloudflare Pages and Netlify via `_redirects`.

## Deploy the API

The Chrome extension talks only to `https://writing-api.zaixos.com`.

1. Build and host `backend/` with `GROQ_API_KEY` set.
2. Terminate TLS on `writing-api.zaixos.com`.
3. Set `CORS_ORIGINS=https://writing.zaixos.com,chrome-extension://`
4. Confirm `GET https://writing-api.zaixos.com/health` returns JSON.

Do not publish the extension until this HTTPS API is live. Chrome Web Store policy requires encrypted transmission of user writing.
