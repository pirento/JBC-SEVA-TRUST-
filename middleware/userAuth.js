const userModel = require("../models/userModel");

// ========================================
// USER AUTHENTICATION MIDDLEWARE
// ========================================
// Also logs out a session that started before the password was last
// changed or reset, so whoever reset it takes the account back.

async function userAuth(req, res, next) {
  const sessionUser = req.session && req.session.user;

  if (sessionUser) {
    try {
      const user = await userModel.findByEmail(sessionUser.email);

      if (
        user &&
        (Number(user.passwordChangedAt) || 0) === sessionUser.passwordChangedAt
      ) {
        return next();
      }

      delete req.session.user;
    } catch (error) {
      return next(error);
    }
  }

  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
}

module.exports = userAuth;
