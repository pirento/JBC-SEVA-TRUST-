# JBC Seva Trust — Website

Node.js + Express + EJS website for JBC Seva Trust: donations and membership through PayU,
medical help requests, user accounts, an admin dashboard and the legal pages.

For setup details, project layout and how to make changes, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Run

```bash
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev
```

Open `http://localhost:3000`.

## Environment (.env)

| Variable | What it is |
| --- | --- |
| `PORT` | Port to listen on (default 3000) |
| `NODE_ENV` | `production` on the live server (turns on secure cookies and proxy support) |
| `SESSION_SECRET` | Long random string; the app will not start without it |
| `DATA_ENCRYPTION_KEY` | 64 hex characters; encrypts every stored record. Back it up, data cannot be read without it |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password: `npm run hash-password -- "your-password"` |
| `EMAIL_USER`, `EMAIL_PASS` | Gmail address and app password used to send emails |
| `TRUST_EMAIL` | Optional: inbox for copies of emails and the daily report (default: the trust email in `config/trustConfig.js`) |
| `PAYU_KEY`, `PAYU_SALT`, `PAYU_ENV` | PayU merchant key/salt; `PAYU_ENV=production` for live payments |
| `PAYU_*_URL` | PayU success/failure callback URLs for membership and donation |
| `MONGODB_URI` | MongoDB connection string (e.g. Atlas). Without it records are kept in encrypted files in `DATA_DIR` (fine for local work) |
| `MONGODB_DB` | Optional: database name (default `jbc_seva_trust`) |
| `DATA_DIR` | Folder for photos and PDF receipts (and records when no MongoDB); default `data/` |
| `APP_URL` | Public address, e.g. `https://jbcsevatrust.org` (links in emails) |
| `BACKUP_DIR` | Folder for nightly backups, ideally another disk (default `data/backups`) |

## Tests

```bash
npm test
```

Starts the real app with a temporary data folder and checks every page, the user journey
(register, login, change password, logout), admin login, form validation, the medical
request flow, a signed PayU donation callback, and login rate limiting.

## Features

- **Pages:** home (programmes, how money is handled, plan, how to help, trustees), a page per programme (`/work/:slug`), donate (choose a cause, then a page per cause with its own purposes, dedication, seva date and gotra for the temple, optional PAN), membership, medical help
- **Volunteer and contact:** `/volunteer` (areas, availability) and `/contact` (general, CSR, events); both listed in the admin dashboard and emailed to `TRUST_EMAIL`
- **Legal:** `/terms`, `/privacy-policy`, `/refund-policy`, `/disclaimer`; every form asks for consent
- **User accounts:** `/register`, `/login`, `/account` (donations, memberships, medical requests and receipts matched by email; change password)
- **Admin:** `/admin/login` → dashboard with daily reports and registered-user count
- **Security:** bcrypt passwords, encrypted records, session id rotated on login, login rate limiting (5 failures → 15 min block), security headers, escaped emails

- **More:** forgot password, Hindi version (`?lang=hi`), field updates with photos, events with registration, monthly giving reminders, WhatsApp receipt/share links
- **Admin:** CSV exports (donations, funds, Form 10BD, volunteers, messages, events, monthly pledges), nightly backups (`npm run backup`)

## Going live

1. Fill every value in `.env` (the server prints what is missing when it starts).
2. `NODE_ENV=production`, HTTPS `APP_URL`, `PAYU_ENV=production` with live keys.
3. Keep `DATA_ENCRYPTION_KEY` safe outside the server; backups cannot be read without it.
4. When 80G is granted, fill `eightyG` in `config/trustConfig.js` and set `approved: true`.

## Structure

- `config/` environment and trust profile (`trustConfig.js`: programmes, trustees, causes)
- `routes/`, `controllers/`, `services/`, `models/` request flow and storage
- `views/` EJS pages; `views/partials/` header, footer, forms; `views/legal/`, `views/user/`
- `middleware/` auth, rate limit, errors
- `public/` CSS, JS, images, fonts
- `test/` automated tests
