const trust = require("../config/trustConfig");

module.exports = function errorHandler(err, req, res, next) {
  console.error("❌ Server Error:", err);
  if (res.headersSent) return next(err);

  // Errors raised before the locals middleware (e.g. bad JSON) still need these for the layout
  res.locals.trust ??= trust;
  res.locals.currentUser ??= null;
  res.locals.isAdmin ??= false;
  res.locals.currentPath ??= req.path;
  res.locals.trustEmail ??= "";
  res.locals.year ??= new Date().getFullYear();
  res.locals.appUrl ??= "";
  res.locals.trustWhatsapp ??= "";

  const status = err.status >= 400 && err.status < 500 ? err.status : 500;

  res.status(status).render("pages/form-error", {
    message: status === 500 ? "Internal Server Error" : "Bad request",
    backUrl: "/",
  });
};
