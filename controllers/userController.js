const userAuthService = require("../services/userAuthService");
const accountService = require("../services/accountService");
const pledgeService = require("../services/pledgeService");

// Only same-site paths, so ?next= cannot send users to another site
function safeNext(value) {
  const next = String(value || "");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/account";
}

// New session id on login stops session fixation
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    const isAdmin = req.session.isAdmin;
    const adminLoginTime = req.session.adminLoginTime;

    req.session.regenerate((error) => {
      if (error) return reject(error);

      req.session.user = user;

      if (isAdmin) {
        req.session.isAdmin = isAdmin;
        req.session.adminLoginTime = adminLoginTime;
      }

      return resolve();
    });
  });
}

function showRegister(req, res) {
  if (req.session.user) return res.redirect("/account");

  return res.render("user/register", { error: null, values: {} });
}

async function register(req, res, next) {
  const body = req.body || {};

  req.rateLimit?.hit();

  try {
    const user = await userAuthService.register(body);
    await startSession(req, user);
    return res.redirect("/account?welcome=1");
  } catch (error) {
    if (!error.expose) return next(error);

    return res.status(400).render("user/register", {
      error: error.message,
      values: { name: body.name, email: body.email, phone: body.phone },
    });
  }
}

function showLogin(req, res) {
  if (req.session.user) return res.redirect(safeNext(req.query.next));

  return res.render("user/login", {
    error: null,
    values: {},
    next: safeNext(req.query.next),
    notice:
      req.query.reset === "1" ? "Your password has been changed. Please log in." : null,
  });
}

async function login(req, res, next) {
  const body = req.body || {};
  const target = safeNext(body.next);

  try {
    const user = await userAuthService.login(body);
    req.rateLimit?.reset();
    await startSession(req, user);
    return res.redirect(target);
  } catch (error) {
    if (!error.expose) return next(error);

    req.rateLimit?.hit();

    return res.status(401).render("user/login", {
      error: error.message,
      values: { email: body.email },
      next: target,
    });
  }
}

function logout(req, res) {
  delete req.session.user;

  req.session.save(() => res.redirect("/"));
}

// Records are matched by email; show them only once the email is proven
async function loadActivity(email) {
  if (!(await userAuthService.isEmailVerified(email))) {
    return {
      verified: false,
      memberships: [],
      donations: [],
      medicalRequests: [],
      pledges: [],
      totalGiven: 0,
    };
  }

  const activity = await accountService.getActivity(email);
  activity.pledges = await pledgeService.pledgesFor(email);
  activity.verified = true;
  return activity;
}

async function account(req, res, next) {
  try {
    const activity = await loadActivity(req.session.user.email);

    return res.render("user/account", {
      activity,
      verifyNotice: req.query.verify || "",
      pledgeStopped: req.query.pledge === "stopped",
      welcome: req.query.welcome === "1",
      passwordChanged: req.query.password === "changed",
      passwordError: null,
    });
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    await userAuthService.changePassword(req.session.user, req.body || {});
    req.rateLimit?.reset();
    return res.redirect("/account?password=changed#security");
  } catch (error) {
    if (!error.expose) return next(error);

    req.rateLimit?.hit();

    try {
      const activity = await loadActivity(req.session.user.email);

      return res.status(400).render("user/account", {
        activity,
        verifyNotice: "",
        pledgeStopped: false,
        welcome: false,
        passwordChanged: false,
        passwordError: error.message,
      });
    } catch (readError) {
      return next(readError);
    }
  }
}

function showForgot(req, res) {
  res.render("user/forgot-password", { sent: false, error: null });
}

async function forgot(req, res, next) {
  req.rateLimit?.hit();

  const email = String((req.body || {}).email || "").trim();
  if (!email) {
    return res
      .status(400)
      .render("user/forgot-password", { sent: false, error: "Please enter your email." });
  }

  try {
    await userAuthService.requestPasswordReset(email);
    return res.render("user/forgot-password", { sent: true, error: null });
  } catch (error) {
    return next(error);
  }
}

async function showReset(req, res, next) {
  try {
    const user = await userAuthService.findByResetToken(req.params.token);
    return res.status(user ? 200 : 400).render("user/reset-password", {
      valid: Boolean(user),
      error: null,
      token: req.params.token,
    });
  } catch (error) {
    return next(error);
  }
}

async function reset(req, res, next) {
  try {
    await userAuthService.resetPassword(req.params.token, req.body || {});
    return res.redirect("/login?reset=1");
  } catch (error) {
    if (!error.expose) return next(error);

    req.rateLimit?.hit();

    return res.status(400).render("user/reset-password", {
      valid: !/invalid or has expired/.test(error.message),
      error: error.message,
      token: req.params.token,
    });
  }
}

async function stopPledge(req, res, next) {
  try {
    await pledgeService.cancelPledge(
      req.session.user.email,
      String((req.body || {}).cause || ""),
    );
    return res.redirect("/account?pledge=stopped#monthly");
  } catch (error) {
    return next(error);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const user = await userAuthService.verifyEmail(req.params.token);

    if (!user) {
      return res.status(400).render("pages/form-error", {
        title: "Link expired",
        message:
          "This confirmation link is invalid or has expired. Log in and ask for a new one from My Account.",
        backUrl: "/account",
      });
    }

    if (req.session.user && req.session.user.email === user.email) {
      req.session.user = user;
    }

    return res.redirect(req.session.user ? "/account?verify=done" : "/login");
  } catch (error) {
    return next(error);
  }
}

async function resendVerification(req, res, next) {
  try {
    req.rateLimit?.hit();
    await userAuthService.requestEmailVerification(req.session.user.email);
    return res.redirect("/account?verify=sent");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  verifyEmail,
  resendVerification,
  stopPledge,
  showForgot,
  forgot,
  showReset,
  reset,
  showRegister,
  register,
  showLogin,
  login,
  logout,
  account,
  changePassword,
};
