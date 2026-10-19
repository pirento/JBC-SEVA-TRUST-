// ========================================
// USER AUTHENTICATION MIDDLEWARE
// ========================================

function userAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

module.exports = userAuth;
