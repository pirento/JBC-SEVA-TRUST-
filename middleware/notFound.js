module.exports = function notFound(req, res) {
  res.status(404).render("pages/404");
};
