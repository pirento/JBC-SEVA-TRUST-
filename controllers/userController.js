const userAuthService = require("../services/userAuthService");
const accountService = require("../services/accountService");
const pledgeService = require("../services/pledgeService");
const googleAuthService = require("../services/googleAuthService");

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

  try {
    const user = await userAuthService.register({ ...body, lang: res.locals.lang });
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
      req.query.reset === "1"
        ? "Your password has been changed. Please log in."
        : req.query.verify === "1"
          ? "Log in to confirm your email."
          : null,
  });
}

async function login(req, res, next) {
  const body = req.body || {};
  const target = safeNext(body.next);

  try {
    const user = await userAuthService.login(body);
    req.rateLimit?.reset();
    await startSession(req, user);
    return res.redirect(user.mustChangePassword ? "/account/set-password" : target);
  } catch (error) {
    if (!error.expose) return next(error);

    return res.status(401).render("user/login", {
      error: error.message,
      values: { email: body.email },
      next: target,
    });
  }
}

// ---------------- Google login ----------------

async function googleStart(req, res, next) {
  try {
    const start = await googleAuthService.startUrl();
    if (!start) return next();
    req.session.googleState = { state: start.state, next: safeNext(req.query.next) };
    return req.session.save(() => res.redirect(start.url));
  } catch (error) {
    return next(error);
  }
}

async function googleCallback(req, res) {
  const saved = req.session.googleState;
  delete req.session.googleState;

  const failed = (message) =>
    res.status(400).render("pages/form-error", {
      title: "Google login did not work",
      message,
      backUrl: "/login",
    });

  if (!saved || !req.query.state || req.query.state !== saved.state) {
    return failed("The login took too long or was started elsewhere. Please try again.");
  }
  if (req.query.error) {
    return failed("Google login was cancelled. You can try again or log in with email.");
  }

  try {
    const profile = await googleAuthService.finish(req.query.code);
    const user = await userAuthService.loginWithGoogle({
      ...profile,
      lang: res.locals.lang,
    });
    await startSession(req, user);
    return res.redirect(saved.next);
  } catch (error) {
    if (error.expose) return failed(error.message);
    console.error("❌ Google login failed:", error.message);
    return failed(
      "Google login did not work. Please try again, or log in with email and password.",
    );
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
  // A temporary password must be replaced before anything else
  if (req.session.user.mustChangePassword) return res.redirect("/account/set-password");

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

function showSetPassword(req, res) {
  if (!req.session.user.mustChangePassword) return res.redirect("/account");
  return res.render("user/set-password", { error: null });
}

async function setPassword(req, res, next) {
  try {
    req.session.user = await userAuthService.setOwnPassword(
      req.session.user,
      req.body || {},
    );
    return res.redirect("/account?password=changed#security");
  } catch (error) {
    if (!error.expose) return next(error);
    return res.status(400).render("user/set-password", { error: error.message });
  }
}

async function changePassword(req, res, next) {
  try {
    // Keeps this session logged in; other sessions are logged out
    req.session.user = await userAuthService.changePassword(
      req.session.user,
      req.body || {},
    );
    req.rateLimit?.reset();
    return res.redirect("/account?password=changed#security");
  } catch (error) {
    if (!error.expose) return next(error);

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

// From the link in a reminder email; works without an account.
// GET only asks, POST stops (mail scanners open links by themselves).
async function monthlyStop(req, res, next) {
  try {
    const input = req.method === "POST" ? req.body || {} : req.query;
    const pledge = pledgeService.readStopLink(input.k, input.t);

    if (!pledge) {
      return res.status(400).render("pages/form-error", {
        title: "Link not valid",
        message:
          "This link is not valid. Please use the link from your latest reminder email.",
        backUrl: "/",
      });
    }

    if (req.method === "POST")
      await pledgeService.cancelPledge(pledge.email, pledge.cause);

    return res.render("pages/monthly-stop", {
      ...pledge,
      k: input.k,
      t: input.t,
      stopped: req.method === "POST",
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const user = await userAuthService.verifyEmail(req.params.token, req.session.user);

    if (user === "login") {
      // Back here after logging in to the account the link belongs to
      const next = `/verify-email/${encodeURIComponent(req.params.token)}`;
      return res.redirect(`/login?next=${encodeURIComponent(next)}&verify=1`);
    }

    if (user === "invalid") {
      return res.status(400).render("pages/form-error", {
        title: "Link expired",
        message:
          "This confirmation link is invalid or has expired. Log in and ask for a new one from My Account.",
        backUrl: "/account",
      });
    }

    req.session.user = user;
    return res.redirect("/account?verify=done");
  } catch (error) {
    return next(error);
  }
}

async function resendVerification(req, res, next) {
  try {
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
  monthlyStop,
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
  showSetPassword,
  setPassword,
  googleStart,
  googleCallback,
};
