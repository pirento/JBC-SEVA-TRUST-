// ========================================
// USER AUTHENTICATION MIDDLEWARE
// ========================================
// Sessions from before a password change are already logged out in
// app.js, so a session user here is current.

function userAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

module.exports = userAuth;
