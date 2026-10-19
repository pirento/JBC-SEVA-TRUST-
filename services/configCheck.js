// Go-live checklist. Only says whether a setting is filled in;
// never exposes the values.
const has = (name) => Boolean(String(process.env[name] || "").trim());

function goLiveChecks() {
  return [
    {
      label: "Running in production mode (NODE_ENV=production)",
      ok: process.env.NODE_ENV === "production",
    },
    {
      label: "Public site address (APP_URL, https)",
      ok: /^https:\/\//.test(process.env.APP_URL || ""),
    },
    {
      label: "Session secret (SESSION_SECRET)",
      ok: has("SESSION_SECRET") && process.env.SESSION_SECRET.length >= 32,
    },
    {
      label: "Data encryption key (DATA_ENCRYPTION_KEY), backed up safely",
      ok: has("DATA_ENCRYPTION_KEY"),
    },
    { label: "Admin password (ADMIN_PASSWORD_HASH)", ok: has("ADMIN_PASSWORD_HASH") },
    {
      label: "Email sending (EMAIL_USER, EMAIL_PASS)",
      ok: has("EMAIL_USER") && has("EMAIL_PASS"),
    },
    {
      label: "PayU live keys (PAYU_KEY, PAYU_SALT)",
      ok: has("PAYU_KEY") && has("PAYU_SALT"),
    },
    {
      label: "PayU in live mode (PAYU_ENV=production)",
      ok: process.env.PAYU_ENV === "production",
    },
    {
      label: "PayU callback URLs (4 × PAYU_*_URL)",
      ok: [
        "PAYU_SUCCESS_URL",
        "PAYU_FAILURE_URL",
        "PAYU_DONATION_SUCCESS_URL",
        "PAYU_DONATION_FAILURE_URL",
      ].every(has),
    },
    { label: "Backups on a separate disk (BACKUP_DIR)", ok: has("BACKUP_DIR") },
  ];
}

function logGoLiveChecks() {
  const missing = goLiveChecks().filter((c) => !c.ok);
  if (missing.length === 0) return;
  console.warn("⚠️  Go-live checklist, still to do:");
  missing.forEach((c) => console.warn("   -", c.label));
}

module.exports = { goLiveChecks, logGoLiveChecks };
