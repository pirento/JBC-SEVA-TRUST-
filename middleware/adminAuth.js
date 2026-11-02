const crypto = require("crypto");

// ========================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ========================================

// An admin login lasts at most this long, even while in use
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

// Changes when ADMIN_PASSWORD_HASH changes, so a new password logs out
// every older admin session
function passwordKey() {
  return crypto
    .createHash("sha256")
    .update(String(process.env.ADMIN_PASSWORD_HASH || ""))
    .digest("hex")
    .slice(0, 16);
}

function isAdminSession(req) {
  const session = req.session;
  return (
    session?.isAdmin === true &&
    session.adminKey === passwordKey() &&
    Date.now() - Number(session.adminLoginAt || 0) < MAX_AGE_MS
  );
}

function adminAuth(req, res, next) {
  if (isAdminSession(req)) {
    return next();
  }

  if (req.session) req.session.isAdmin = false;
  return res.redirect("/admin/login");
}

module.exports = adminAuth;
module.exports.isAdminSession = isAdminSession;
module.exports.passwordKey = passwordKey;
