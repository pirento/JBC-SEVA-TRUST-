# JBC Seva Trust — MVC EJS

This version is a structural MVC refactor of the supplied working project.

## Important
- Existing UI/CSS/assets are preserved.
- Existing Medical Help flow is preserved, including PDF generation, storage in `data/receipts/`, email and download.
- Existing Donation flow is preserved, including PayU test/production selection, hash verification, `payment.txt`, receipt generation, automatic browser download, email PDF attachment and inline logo CID.
- Donation receipt PDFs are not permanently stored; they are regenerated from `payment.txt` and cached in memory for a limited time.
- Existing `data/user.txt` and `data/payment.txt` storage remains plain text for this phase.
- Bcrypt/hash-at-rest is intentionally not included yet.
- Real credentials are not included. Copy `.env.example` to `.env` and add your own values.

## Run
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Structure
- `controllers/` request/response orchestration
- `services/` business workflows, PayU, email and PDF logic
- `models/` persistence and in-memory transaction/receipt state
- `routes/` HTTP route definitions
- `views/` EJS pages and reusable partial components
- `middleware/` 404 and global error handling
- `config/` environment-derived configuration
- `utils/` validation and shared helpers
- `public/` unchanged UI assets
- `data/` runtime text storage and medical receipt files
