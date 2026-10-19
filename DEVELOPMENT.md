# Development Guide — JBC Seva Trust website

How to set up, run, test and change this project. For what the site does, see `README.md`.

## 1. Requirements

- Node.js 20 or newer (developed on Node 22)
- npm
- No database server: records are stored as encrypted text files in `data/`

## 2. First-time setup

```bash
npm install
cp .env.example .env
```

Fill `.env`. The minimum to start the site locally:

| Variable | How to get it |
| --- | --- |
| `SESSION_SECRET` | Any long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATA_ENCRYPTION_KEY` | 64 hex characters, made the same way. **Never change it once data exists**: old records could no longer be read. |
| `ADMIN_PASSWORD_HASH` | `npm run hash-password -- "your-admin-password"` and paste the printed line |

Optional for local work: `PAYU_*` (PayU test keys), `EMAIL_USER`/`EMAIL_PASS` (Gmail app password), `TRUST_EMAIL`, `APP_URL`, `BACKUP_DIR`, `DATA_DIR`. Without email settings, emails are skipped with an error in the log and everything else still works.

## 3. Run

```bash
npm run dev      # restarts on file changes (nodemon)
npm start        # plain node
```

Open http://localhost:3000. Admin: http://localhost:3000/admin/login.

When the server starts it prints any settings still missing for going live.

## 4. Tests

```bash
npm test
```

- `test/app.test.js` starts the real app on a random port with a temporary data folder, drives it over HTTP and deletes the folder afterwards. It covers pages, accounts, admin, forms, every donation cause, a signed PayU callback, certificates, CSV exports, updates and events, monthly reminders, Hindi and rate limits.
- `test/validation.test.js` covers the small validators.
- No real email, PayU or WhatsApp calls are made.
- Run the tests before every push. Add a test with every new feature or bug fix.

## 5. Project layout

```
app.js                 Express setup: security headers, session, language, routes
config/
  trustConfig.js       Trust facts: programmes, donation causes and purposes, trustees, 80G switch
  appConfig.js         Port, data folder, APP_URL
  emailConfig.js       Email login and trust inbox
  payuConfig.js        PayU keys and callback URLs
routes/                URL → controller (one file per area)
controllers/           Read the request, call services, render a view
services/              Business logic. Naming: donation* = gifts to a cause (/donate),
                       membership* = membership (/donation URL), medical* = medical help.
                       Also PayU, certificates, emails, exports, admin dashboard,
                       backups, monthly pledges, updates and events
models/                Storage on top of models/fileStore.js
middleware/            Admin/user login checks, rate limit, bot trap (honeypot),
                       uploads, Hindi, errors
views/
  partials/            head, header, footer, forms, icons, cards
  pages/               Public pages
  user/                Login, register, account, password reset
  admin/               Admin dashboard and Updates & Events
  legal/               Terms, privacy, refund, disclaimer
locales/hi.js          Hindi text, keyed by the English text
public/                CSS, JS, logo images, fonts
scripts/               hash-password, backup
test/                  Automated tests
data/                  Runtime data (not in git): *.txt records, receipts/, uploads/, backups/
```

## 6. How data is stored

- Each record is one encrypted (AES-256-GCM) JSON line in a `data/*.txt` file (`models/fileStore.js`).
- Files are append-only. An edit appends a new version (latest wins, e.g. user accounts). A delete appends a `DELETE` record (updates, events).
- Main files: `donations.txt`, `payment.txt` (memberships), `user.txt` (medical requests), `accounts.txt`, `volunteers.txt`, `messages.txt`, `updates.txt`, `events.txt`, `event-registrations.txt`, `pledges.txt`, `pending-payments.txt`.
- Uploaded photos go to `data/uploads/` with random names.
- Backups: every night at 02:30 IST to `BACKUP_DIR` (default `data/backups/`), last 30 kept. Run `npm run backup` any time. Backups are encrypted, so keep `DATA_ENCRYPTION_KEY` safe outside the server.

## 7. Common changes

### Change trust details, a programme or a donation cause
Edit `config/trustConfig.js` only; pages, forms, certificates and exports read from it.
- Purposes and suggested amounts: `donation.purposes` and `donation.amounts` of a programme.
- `sevaDate: true` adds a "preferred seva date" field; `gotra: true` adds gotra; `religious: true` marks the temple fund (no 80G).
- After changing visible English text, add its Hindi to `locales/hi.js`.

### When 80G is approved
In `config/trustConfig.js`, fill `eightyG` (registration number, dates, trust PAN) and set `approved: true`. Certificates then show the 80G details. Never set it earlier.

### Add or change visible text
1. Write it in English in the view.
2. Add the same English text with its Hindi to `locales/hi.js`. The key must match the text on the page exactly (spaces are ignored).
3. Check `/?lang=hi`. Form `value`s are never translated, so server checks stay in English.

### Add a page
1. Add a route in `routes/`, a controller function, and a view in `views/pages/`.
2. Start the view with `<%- include('../partials/head', { title: '...' }) %>` and the header/footer partials.
3. Add a test in `test/app.test.js`.

### Add a public form
1. Put `<%- include('../partials/honeypot', { hpId: 'name' }) %>` inside the form and `honeypot` before the controller in the route.
2. Add a rate limiter (`middleware/rateLimit.js`) for the POST route.
3. Validate on the server (`utils/validation.js`: `personName`, `phone`, `email`, `accepted`, `fewLinks`) and refuse obvious duplicates before saving.
4. After a successful POST, redirect to a GET page instead of rendering.

### Add an admin CSV export
Add an entry to `exports_` in `services/exportService.js`. It appears on the dashboard automatically at `/admin/export/<name>`.

### Change the certificate design
Both certificates use `services/certificateDesign.js`. Donation text is in `services/donationCertificateService.js`, membership in `services/membershipCertificateService.js`. Check a sample by rendering one to PDF.

## 8. Coding rules

- Validate every form on the server, even if the browser also checks it.
- Show user text with `<%= %>` (escaped). Use `<%- %>` only for partials and icons.
- Throw user-facing errors with `expose = true` (see `services/userAuthService.js`) so controllers show them in the form; other errors go to the error page.
- Never write invented numbers or claims (results, 80G, registrations) on the site. Plans must say they are plans.
- Keep the look plain: logo colours (navy `#15375c`, saffron `#dd870d`), Noto Serif headings, Noto Sans text, line icons, no emoji.
- Run `npm run format` before committing; Prettier keeps one style (`.prettierrc.json`).
- Commit messages: a short summary line, then what changed and why.

## 9. Security notes

- Passwords: bcrypt. Reset tokens: random, stored hashed, one hour, single use.
- Sessions: new id at every login, `httpOnly`, `sameSite=lax`, `secure` in production.
- Login, register, password, volunteer, contact and event forms are rate limited per IP (in memory).
- Every public form has a hidden bot-trap field; names with links are refused; repeated volunteer, message, event and medical submissions are not stored twice.
- Account records are shown only after the email is confirmed (link sent on register; a password reset also confirms it).
- After PayU returns, the result is saved and the browser is redirected (303) to a thank-you or payment-failed page.
- PayU callbacks are checked by hash, amount and transaction id; cause and purpose are inside the signed fields.
- Uploads: JPG/PNG/WebP only, checked by their first bytes, 5 MB limit, random file names.
- CSV exports block spreadsheet formulas; medical exports show only the last 4 Aadhaar digits.

## 10. Going live

1. Server with Node 20+, behind HTTPS (Nginx, Render, Railway, etc.).
2. `.env`: `NODE_ENV=production`, `APP_URL=https://...`, live PayU keys with `PAYU_ENV=production` and the four callback URLs, Gmail app password (`EMAIL_USER=jbcsevatrust@gmail.com`), `BACKUP_DIR` on its own empty folder on another disk (old backups there are pruned). Behind Cloudflare plus another proxy, set `TRUST_PROXY=2`. `TRUST_EMAIL` is optional (defaults to the trust email).
3. In the PayU dashboard set the webhook to `https://<your-site>/payu/webhook` (see `docs/payment-notes.md`).
4. Start with `npm start` under a process manager (pm2 or the host's own) and check the startup log for missing settings.
5. Make one small real donation and check the receipt email, the certificate and the admin dashboard.

## 11. Known limits

- File storage reads whole files (decrypted records are cached until the file changes); move to a database (PostgreSQL) when records reach the tens of thousands.
- Measured with 5,000 donations, 2,000 accounts and 1,500 memberships (production mode, one process): public pages about 550–1,000 requests per second; admin dashboard about 7 ms per request.
- Sessions and rate limits are in memory: a restart logs everyone out, and it supports one server process only.
- Monthly giving sends email reminders; automatic debits need PayU standing instructions.
- WhatsApp sharing uses links; automatic messages need the WhatsApp Business API.
- Hindi names in PDFs may not join letters correctly (no complex script shaping in pdfkit).
