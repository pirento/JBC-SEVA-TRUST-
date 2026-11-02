// ========================================
// USER AUTHENTICATION MIDDLEWARE
// ========================================
// Sessions from before a password change are already logged out in
// app.js, so a session user here is current.

function userAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  // A form posted after the session ended has no page to come back to
  const back = req.method === "GET" ? req.originalUrl : "/account";
  return res.redirect(`/login?next=${encodeURIComponent(back)}`);
}

module.exports = userAuth;
