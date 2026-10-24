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
    // Optional overrides; a donation URL pointing at the membership
    // callback (or the reverse) makes every payment fail to save
    ...[
      ["PAYU_SUCCESS_URL", "/donation/success"],
      ["PAYU_FAILURE_URL", "/donation/failure"],
      ["PAYU_DONATION_SUCCESS_URL", "/donate/success"],
      ["PAYU_DONATION_FAILURE_URL", "/donate/failure"],
    ].map(([name, end]) => ({
      label: `${name} must end with ${end} (or leave it out)`,
      ok: !has(name) || process.env[name].trim().replace(/\/+$/, "").endsWith(end),
    })),
    { label: "Backups on a separate disk (BACKUP_DIR)", ok: has("BACKUP_DIR") },
    { label: "Database: MongoDB (MONGODB_URI)", ok: has("MONGODB_URI") },
  ];
}

function logGoLiveChecks() {
  const missing = goLiveChecks().filter((c) => !c.ok);
  if (missing.length === 0) return;
  console.warn("⚠️  Go-live checklist, still to do:");
  missing.forEach((c) => console.warn("   -", c.label));
}

module.exports = { goLiveChecks, logGoLiveChecks };
