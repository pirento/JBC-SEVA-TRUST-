// Legal pages: URL path -> view and page title
const legalPages = {
  "/terms": { view: "legal/terms", title: "Terms & Conditions" },
  "/privacy-policy": { view: "legal/privacy", title: "Privacy Policy" },
  "/refund-policy": { view: "legal/refund", title: "Refund & Cancellation Policy" },
  "/disclaimer": { view: "legal/disclaimer", title: "Disclaimer" },
};

// Last time the legal text was changed; update when editing it
const LEGAL_UPDATED = "18 October 2026";

const trust = require("../config/trustConfig");

function home(req, res) {
  res.render("pages/index");
}

function programme(req, res, next) {
  const item = trust.programmes.find((p) => p.slug === req.params.slug);
  if (!item) return next();
  return res.render("pages/programme", { programme: item, title: item.title });
}

function legal(req, res) {
  const page = legalPages[req.path];
  res.render(page.view, { title: page.title, updated: LEGAL_UPDATED });
}

module.exports = { home, programme, legal, legalPages };
