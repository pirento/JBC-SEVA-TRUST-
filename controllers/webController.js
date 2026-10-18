// Legal pages: URL path -> view and page title
const legalPages = {
  "/terms": { view: "legal/terms", title: "Terms & Conditions" },
  "/privacy-policy": { view: "legal/privacy", title: "Privacy Policy" },
  "/refund-policy": { view: "legal/refund", title: "Refund & Cancellation Policy" },
  "/disclaimer": { view: "legal/disclaimer", title: "Disclaimer" },
};

// Last time the legal text was changed; update when editing it
const LEGAL_UPDATED = "18 October 2026";

function home(req, res) {
  res.render("pages/index");
}

function legal(req, res) {
  const page = legalPages[req.path];
  res.render(page.view, { title: page.title, updated: LEGAL_UPDATED });
}

module.exports = { home, legal, legalPages };
