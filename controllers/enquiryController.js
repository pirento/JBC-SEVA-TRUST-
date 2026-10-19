const enquiryService = require("../services/enquiryService");
const trust = require("../config/trustConfig");

function showVolunteer(req, res) {
  res.render("pages/volunteer", {
    error: null,
    values: {},
    done: req.query.done === "1",
  });
}

async function submitVolunteer(req, res, next) {
  try {
    await enquiryService.registerVolunteer(req.body || {});
    return res.redirect("/volunteer?done=1");
  } catch (error) {
    if (!error.expose) return next(error);

    return res.status(400).render("pages/volunteer", {
      error: error.message,
      values: req.body || {},
      done: false,
    });
  }
}

function showContact(req, res) {
  const type = {
    csr: "CSR or major donation",
    volunteer: "Volunteer interest",
    event: "Event support",
  }[req.query.type];

  res.render("pages/contact", {
    error: null,
    values: { enquiryType: type || trust.enquiryTypes[0] },
    done: req.query.done === "1",
  });
}

async function submitContact(req, res, next) {
  try {
    await enquiryService.sendMessage(req.body || {});
    return res.redirect("/contact?done=1");
  } catch (error) {
    if (!error.expose) return next(error);

    return res.status(400).render("pages/contact", {
      error: error.message,
      values: req.body || {},
      done: false,
    });
  }
}

module.exports = { showVolunteer, submitVolunteer, showContact, submitContact };
