# JBC Seva Trust website

Node/Express + EJS MVC app, rebranded from the Manorama Charitable Trust project.

## Trust facts (from "JBC Seva Trust — Profile, Work Plan & Governance", Oct 2026)
- Public charitable trust, Basti, Uttar Pradesh. Not linked to Venturecore Solutions Pvt Ltd.
- Trustees: Jang Bahadur Chaudhary ("JBC", founder) and Ravikant Soni (managing trustee).
- Tagline: "Serving humanity. Preserving nature."
- Programmes: Green Earth, Anand Dham (old age home), Kanyadaan, Vidya and Poshan, Community Temple (separate fund head).
- Not yet known: registration no., PAN, 12A/80G, helpline, email, website. Never invent these or claim 80G/FCRA before approval.

## Brand
- Logo: `public/images/logo-mark.png` (emblem, header/favicon), `logo.jpeg` (emails; PDFs use logo-mark.png), `logo-full.png` (with wordmark).
- Colours from the logo: navy `#14365d`, saffron `#d97706` / `#e88c09`. Headings Noto Serif, body Noto Sans.
- Keep the look plain and factual: no emoji, no invented numbers; plans are labelled as plans.

## Code notes
- Trust facts used by pages live in `config/trustConfig.js`; change them there, not in views.
- Every page uses `views/partials/head|header|footer`; `res.locals` gives `trust`, `currentUser`, `isAdmin`, `trustEmail`.
- Storage is encrypted append-only text files (`models/fileStore.js`); accounts in `accounts.txt`, latest record per email wins.
- Run `npm test` before pushing.

## Donations
- Each cause has its own page `/donate/<slug>` driven by `donation` in `config/trustConfig.js` (purposes, suggested amounts, `sevaDate`, `gotra`, `religious`).
- Cause goes to PayU as udf4 and purpose as udf5 (both signed); other details live in the pending store.
- Temple (`religious`) receipts say the money is in the separate Temple Fund and generally not 80G eligible.

## Pending
- Forgot-password by email (needs working email config).
- Add real helpline/email/website to `views/partials/footer.ejs`; set `TRUST_EMAIL` in `.env`.
