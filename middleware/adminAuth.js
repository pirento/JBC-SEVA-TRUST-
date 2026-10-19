// ========================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ========================================

function adminAuth(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  return res.redirect("/admin/login");
}

module.exports = adminAuth;
