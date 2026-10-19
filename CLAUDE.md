# JBC Seva Trust website

Node/Express + EJS MVC app, rebranded from the Manorama Charitable Trust project.

## Trust facts (from "JBC Seva Trust — Profile, Work Plan & Governance", Oct 2026)
- Public charitable trust, Basti, Uttar Pradesh. Not linked to Venturecore Solutions Pvt Ltd.
- Trustees: Jang Bahadur Chaudhary ("JBC", founder) and Ravikant Soni (managing trustee).
- Tagline: "Serving humanity. Preserving nature."
- Programmes: Green Earth, Anand Dham (old age home), Kanyadaan, Vidya and Poshan, Community Temple (separate fund head).
- Contact: email jbcsevatrust@gmail.com, phone and WhatsApp 9648191111 (`email`, `phone`, `phoneDisplay` in trustConfig; used in header, footer, contact page, legal pages, emails and the WhatsApp button).
- Not yet known: registration no., PAN, 12A/80G, website. Never invent these or claim 80G/FCRA before approval.

## Brand
- Logo (hands holding a heart): `public/images/logo-mark.png` (emblem; header, PDFs), `logo.jpeg` (emails), `logo-full.png`, `logo-wordmark.png`, `favicon-32.png`, `apple-touch-icon.png`.
- Colours from the logo: navy `#15375c`, saffron `#dd870d` (text uses darker `#d97706`/`#b86304` for contrast). Headings Noto Serif, body Noto Sans.
- Keep the look plain and factual: no emoji, no invented numbers; plans are labelled as plans.

## Naming
- donation* = gifts to a cause (URL /donate); membership* = membership (URL /donation, kept for PayU settings); medical* = medical help.

## Code notes
- Trust facts used by pages live in `config/trustConfig.js`; change them there, not in views.
- Legal pages (`views/legal/*`) are written around the trust's actual work (causes, temple fund, seva dates, Kanyadaan, volunteers, photos); bump `LEGAL_UPDATED` in `controllers/webController.js` when editing.
- Every page uses `views/partials/head|header|footer`; `res.locals` gives `trust`, `currentUser`, `isAdmin`, `trustEmail`.
- Storage is encrypted append-only text files (`models/fileStore.js`); accounts in `accounts.txt`, latest record per email wins.
- Run `npm test` and `npm run format` before pushing.
- Public forms: honeypot partial + middleware, rate limit, server validation, duplicate check, redirect after POST.
- Account records need a confirmed email (`emailVerified`).
- Password change/reset bumps `passwordChangedAt`; `middleware/userAuth.js` logs out older sessions.
- App runs in Indian time (`process.env.TZ` set in app.js). Production: `TRUST_PROXY` = proxy hops (default 1), `SESSION_SECRET` >= 32 chars, `PAYU_ENV` test|production.

## Donations
- Each cause has its own page `/donate/<slug>` driven by `donation` in `config/trustConfig.js` (purposes, suggested amounts, `sevaDate`, `gotra`, `religious`).
- Cause goes to PayU as udf4 and purpose as udf5 (both signed); other details live in the pending store.
- Temple (`religious`) receipts say the money is in the separate Temple Fund and generally not 80G eligible.

## Hindi
- `?lang=hi` / cookie `lang`. `middleware/i18n.js` translates rendered HTML text nodes and placeholder/title/aria-label/alt via `locales/hi.js` (keyed by the English text) plus a few sentence patterns. Form `value`s are never translated.
- When adding visible English text, add its Hindi to `locales/hi.js`. Legal pages and `/admin` stay English.

## Features added later
- Forgot password (`/forgot-password`, hashed one-hour tokens, needs `APP_URL`).
- Admin CSV exports `/admin/export/:type` incl. Form 10BD; 80G switch `eightyG` in trustConfig (keep `approved: false` until granted).
- Updates with photos and events: `/admin/content`, `/updates`, `/events`; photos in `DATA_DIR/uploads` (byte-checked).
- Monthly giving = email reminders (`services/pledgeService.js`), not auto-debit.
- Nightly backups (`services/backupService.js`, `BACKUP_DIR`): records, photos and medical receipts; unchanged photos/receipts hard-linked to the previous backup; missing go-live settings are printed at server start (`services/configCheck.js`), not shown in admin.

## Pending
- Move storage to a real database (PostgreSQL) before traffic grows.
- PayU standing instructions for automatic monthly debits (needs merchant enablement).
- Website domain (set `APP_URL` once known).
