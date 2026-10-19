# Payment reliability fixes

- Pending payment attempts are now written to the project's encrypted append-only `data/pending-payments.txt` store via `models/fileStore.js`, rather than relying only on process memory.
- Membership and donation payment initiation now await durable pending-record writes before rendering the PayU form.
- Callback lookups await the persistent store, so a process restart no longer removes the pending form data.
- Failure callbacks no longer delete pending attempts just because the failure endpoint was called; this avoids losing data due to unverified/retried callbacks.
- Transaction IDs retain the `TXN_` prefix and now use a larger random suffix.
- Existing EJS templates, routes, and certificate URL formats were left in place.

## Before deploying

1. Configure `.env` using `.env.example`; never upload `.env` or commit secrets.
2. Ensure `DATA_ENCRYPTION_KEY` is the same 64-character hex key used to encrypt existing data files.
3. Back up the current `data/` directory before deploying.
4. Run a PayU test-mode payment and verify success, failure, duplicate callback, membership record, certificate download, and email delivery.
5. Keep the `data/` directory on persistent writable storage. If hosting redeploys wipe local files, use a persistent volume or database.

Syntax validation passed for all project JavaScript files. Live PayU/Hostinger end-to-end testing has not been performed.

## Production hardening (Oct 2026)

- New PayU webhook: `POST /payu/webhook`. In PayU Dashboard -> Developers -> Webhooks, add
  `https://<your-site>/payu/webhook` for the **Successful payment** event. Payments are now
  recorded even if the customer closes GPay/the browser before returning to the site.
- Browser callback and webhook for the same txnid are processed one at a time, so the record
  is saved once and the confirmation email is sent once.
- Payment pages no longer re-post an already used txnid to PayU (Back button / page restore).
- Response hash supports PayU `additionalCharges` (convenience fee).
- The test email is sent from admin Settings (POST, admin only); donation certificate URLs validate the transaction ID.
