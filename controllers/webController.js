// Legal pages: URL path -> view and page title
const legalPages = {
  "/terms": { view: "legal/terms", title: "Terms & Conditions" },
  "/privacy-policy": { view: "legal/privacy", title: "Privacy Policy" },
  "/refund-policy": { view: "legal/refund", title: "Refund & Cancellation Policy" },
  "/disclaimer": { view: "legal/disclaimer", title: "Disclaimer" },
};

// Last time the legal text was changed; update when editing it
const LEGAL_UPDATED = "19 October 2026";

const trust = require("../config/trustConfig");
const contentModel = require("../models/contentModel");
const { isUpcoming } = require("../services/contentService");

async function home(req, res, next) {
  try {
    const [updates, events] = await Promise.all([
      contentModel.listUpdates(),
      contentModel.listEvents(),
    ]);
    res.render("pages/index", {
      latestUpdates: updates.slice(0, 3),
      upcomingEvents: events.filter(isUpcoming).slice(0, 3),
    });
  } catch (error) {
    next(error);
  }
}

async function programme(req, res, next) {
  try {
    const item = trust.programmes.find((p) => p.slug === req.params.slug);
    if (!item) return next();

    const updates = (await contentModel.listUpdates()).filter(
      (u) => u.programme === item.slug,
    );
    return res.render("pages/programme", {
      programme: item,
      title: item.title,
      updates: updates.slice(0, 4),
    });
  } catch (error) {
    return next(error);
  }
}

function legal(req, res) {
  // Express matches "/Terms/" too; req.path keeps the case and the slash
  const page = legalPages[req.path.toLowerCase().replace(/(.)\/+$/, "$1")];
  res.render(page.view, { title: page.title, updated: LEGAL_UPDATED });
}

module.exports = { home, programme, legal, legalPages };
