// ========================================
// BOT TRAP
// ========================================
//
// Every public form has a hidden "website" field (views/partials/
// honeypot.ejs). People never see it; simple spam bots fill it in.
// Such submissions are dropped before anything is saved.
// ========================================

function honeypot(req, res, next) {
  if (String((req.body || {}).website || "").trim()) {
    console.warn("🚫 Bot submission dropped:", req.method, req.originalUrl);

    return res.status(400).render("pages/form-error", {
      message: "Your submission could not be accepted. Please try again.",
      backUrl: req.originalUrl,
    });
  }

  return next();
}

module.exports = honeypot;
