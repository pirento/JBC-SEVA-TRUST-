const userModel = require("../models/userModel");
const userAuthService = require("../services/userAuthService");

const DONE = {
  reset: "Password reset link sent to",
  login: "New login details sent to",
};

// ========================================
// USERS LIST
// ========================================

async function list(req, res, next) {
  try {
    const q = String(req.query.q || "")
      .trim()
      .toLowerCase()
      .slice(0, 100);
    const all = (await userModel.listUsers()).sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    );
    const matches = q
      ? all.filter((u) =>
          [u.name, u.email, u.phone].some((v) =>
            String(v || "")
              .toLowerCase()
              .includes(q),
          ),
        )
      : all;

    const done = DONE[req.query.done] && String(req.query.email || "");

    return res.render("admin/users", {
      q,
      total: matches.length,
      users: matches.slice(0, 100),
      notice: done ? `${DONE[req.query.done]} ${done}.` : "",
    });
  } catch (error) {
    return next(error);
  }
}

// ========================================
// ACTIONS (emails go to the account's own address)
// ========================================

function action(run, done) {
  return async (req, res, next) => {
    try {
      const user = await userModel.findByEmail((req.body || {}).email);
      if (!user) return res.redirect("/admin/users");
      await run(user);
      const query = new URLSearchParams({ done, email: user.email });
      return res.redirect(`/admin/users?${query}`);
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  list,
  // A link to choose a new password; the current password keeps working until then
  sendReset: action((user) => userAuthService.requestPasswordReset(user.email), "reset"),
  // A new temporary password replaces the current one
  sendLoginDetails: action((user) => userAuthService.sendLoginDetails(user), "login"),
};
