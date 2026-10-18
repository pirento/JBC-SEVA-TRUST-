module.exports = function errorHandler(err, req, res, next) {
  console.error("❌ Server Error:", err);
  if (res.headersSent) return next(err);
  res.status(500).render("pages/form-error", { message: "Internal Server Error", backUrl: "/" });
};
