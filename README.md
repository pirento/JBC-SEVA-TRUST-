# JBC Seva Trust — Website

Node.js + Express + EJS website for JBC Seva Trust: donations and membership through PayU,
medical help requests, user accounts, an admin dashboard and the legal pages.

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
| `TRUST_EMAIL` | Trust inbox: gets a copy of every email and the daily report; shown in the footer |
| `PAYU_KEY`, `PAYU_SALT`, `PAYU_ENV` | PayU merchant key/salt; `PAYU_ENV=production` for live payments |
| `PAYU_*_URL` | PayU success/failure callback URLs for membership and donation |
| `DATA_DIR` | Optional: folder for data files (default `data/`) |

## Tests

```bash
npm test
```

Starts the real app with a temporary data folder and checks every page, the user journey
(register, login, change password, logout), admin login, form validation, the medical
request flow, a signed PayU donation callback, and login rate limiting.

## Features

- **Pages:** home (five programmes, how we work, trustees), donate (choose a cause), membership, medical help
- **Legal:** `/terms`, `/privacy-policy`, `/refund-policy`, `/disclaimer`; every form asks for consent
- **User accounts:** `/register`, `/login`, `/account` (donations, memberships, medical requests and receipts matched by email; change password)
- **Admin:** `/admin/login` → dashboard with daily reports and registered-user count
- **Security:** bcrypt passwords, encrypted records, session id rotated on login, login rate limiting (5 failures → 15 min block), security headers, escaped emails

## Structure

- `config/` environment and trust profile (`trustConfig.js`: programmes, trustees, causes)
- `routes/`, `controllers/`, `services/`, `models/` request flow and storage
- `views/` EJS pages; `views/partials/` header, footer, forms; `views/legal/`, `views/user/`
- `middleware/` auth, rate limit, errors
- `public/` CSS, JS, images, fonts
- `test/` automated tests
