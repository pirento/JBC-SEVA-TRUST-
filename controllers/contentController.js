const contentModel = require("../models/contentModel");
const contentService = require("../services/contentService");
const trust = require("../config/trustConfig");

// ---------------- Public ----------------

async function updates(req, res, next) {
  try {
    const programme = trust.programmes.find((p) => p.slug === req.query.programme) || null;
    const all = await contentModel.listUpdates();
    res.render("pages/updates", {
      title: "Updates from the Field",
      updates: programme ? all.filter((u) => u.programme === programme.slug) : all,
      programme,
    });
  } catch (error) {
    next(error);
  }
}

async function events(req, res, next) {
  try {
    const all = await contentModel.listEvents();
    res.render("pages/events", {
      title: "Events",
      upcoming: all.filter(contentService.isUpcoming),
      past: all.filter((e) => !contentService.isUpcoming(e)).reverse(),
    });
  } catch (error) {
    next(error);
  }
}

async function renderEvent(res, event, extra = {}, status = 200) {
  res.status(status).render("pages/event", {
    title: event.title,
    event,
    open: contentService.isUpcoming(event),
    error: null,
    values: {},
    done: false,
    ...extra,
  });
}

async function event(req, res, next) {
  try {
    const item = await contentModel.findEvent(req.params.id);
    if (!item) return next();
    return renderEvent(res, item, { done: req.query.done === "1" });
  } catch (error) {
    return next(error);
  }
}

async function registerEvent(req, res, next) {
  req.rateLimit?.hit();

  try {
    const item = await contentModel.findEvent(req.params.id);
    if (!item) return next();

    try {
      await contentService.registerForEvent(item, req.body || {});
      return res.redirect(`/events/${item.id}?done=1`);
    } catch (error) {
      if (!error.expose) throw error;
      return renderEvent(res, item, { error: error.message, values: req.body || {} }, 400);
    }
  } catch (error) {
    return next(error);
  }
}

// ---------------- Admin ----------------

async function adminContent(req, res, next, extra = {}, status = 200) {
  try {
    const [updatesList, eventsList, registrations] = await Promise.all([
      contentModel.listUpdates(),
      contentModel.listEvents(),
      contentModel.listRegistrations(),
    ]);

    res.status(status).render("admin/content", {
      title: "Updates & Events",
      updates: updatesList,
      events: eventsList,
      registrations,
      error: null,
      notice: req.query.saved ? "Saved." : null,
      values: {},
      ...extra,
    });
  } catch (error) {
    next(error);
  }
}

function adminAction(action) {
  return async (req, res, next) => {
    try {
      await action(req);
      return res.redirect("/admin/content?saved=1");
    } catch (error) {
      if (!error.expose) return next(error);
      return adminContent(req, res, next, { error: error.message, values: req.body || {} }, 400);
    }
  };
}

module.exports = {
  updates,
  events,
  event,
  registerEvent,
  adminContent: (req, res, next) => adminContent(req, res, next),
  createUpdate: adminAction((req) => contentService.createUpdate(req.body || {}, req.file, req.uploadError)),
  deleteUpdate: adminAction((req) => contentModel.removeUpdate(req.params.id)),
  createEvent: adminAction((req) => contentService.createEvent(req.body || {})),
  deleteEvent: adminAction((req) => contentModel.removeEvent(req.params.id)),
};
