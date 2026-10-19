const { appUrl } = require("../config/appConfig");

// ========================================
// SAME-ORIGIN CHECK FOR FORMS
// ========================================
// Blocks a form posted from another website (for example one that
// logs a visitor into someone else's account). Browsers send Origin
// (or at least Referer) on form posts; if both are missing we allow
// the request rather than break an unusual browser.
// PayU posts its callbacks from its own site, so those paths are skipped.
// ========================================

const PAYU_CALLBACKS = new Set([
  "/donate/success",
  "/donate/failure",
  "/donation/success",
  "/donation/failure",
  "/payu/webhook",
]);

// www.jbcsevatrust.org and jbcsevatrust.org count as the same site
const bare = (host) =>
  String(host || "")
    .toLowerCase()
    .replace(/^www\./, "");

function hostOf(url) {
  try {
    return bare(new URL(url).host);
  } catch {
    return "";
  }
}

function sameOrigin(req, res, next) {
  // Express matches routes ignoring case and a trailing slash; so must this
  const path = req.path.toLowerCase().replace(/\/+$/, "");
  if (req.method !== "POST" || PAYU_CALLBACKS.has(path)) return next();

  const source = req.get("origin") || req.get("referer");
  if (!source) return next();

  // Host header, the proxy's forwarded host, or APP_URL in case a proxy rewrites Host
  const allowed = [req.get("host"), req.host, appUrl].map((h) =>
    h === appUrl ? hostOf(h) : bare(h),
  );
  if (allowed.includes(hostOf(source))) return next();

  return res.status(403).render("pages/form-error", {
    title: "Form not accepted",
    message: "This form must be sent from the JBC Seva Trust website. Please try again.",
    backUrl: "/",
  });
}

module.exports = sameOrigin;
