const { authenticateAdmin } = require("../services/adminAuthService");
const { isAdminSession, passwordKey } = require("../middleware/adminAuth");
const { realDate } = require("../utils/validation");
const { getDailyReport, indiaDate } = require("../services/adminReportService");
const { generateDailyReportPdf } = require("../services/adminReportPdfService");
const { getDashboard } = require("../services/adminDashboardService");
const { buildExport, exportTypes } = require("../services/exportService");
const store = require("../models/pendingPaymentStore");
const { fetchPayUStatus } = require("../services/payuService");

// ========================================
// SHOW ADMIN LOGIN
// ========================================

exports.showLogin = (req, res) => {
  if (isAdminSession(req)) {
    return res.redirect("/admin/dashboard");
  }

  return res.render("admin/login", { error: null });
};

// ========================================
// ADMIN LOGIN
// ========================================

exports.login = async (req, res) => {
  try {
    const password = String(req.body.password || "");

    if (!password) {
      return res.status(400).render("admin/login", {
        error: "Password is required",
      });
    }

    const result = await authenticateAdmin({ password });

    if (!result.success) {
      return res.status(401).render("admin/login", {
        error: "Invalid admin password",
      });
    }

    req.rateLimit?.reset();

    // New session id on login stops session fixation;
    // a logged-in website user stays logged in.
    const user = req.session.user;

    await new Promise((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );

    if (user) {
      req.session.user = user;
    }

    req.session.isAdmin = true;
    req.session.adminLoginAt = Date.now();
    req.session.adminKey = passwordKey();

    return res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("❌ Admin login error:", error.message);

    return res.status(500).render("admin/login", {
      error: "Unable to process login",
    });
  }
};

// ========================================
// DASHBOARD
// ========================================

exports.dashboard = async (req, res, next) => {
  try {
    const data = await getDashboard({
      date: String(req.query.date || ""),
      view: String(req.query.view || ""),
      q: String(req.query.q || ""),
      page: req.query.page,
      from: String(req.query.from || ""),
      to: String(req.query.to || ""),
    });

    const done = String(req.query.done || "");
    return res.render("admin/dashboard", {
      ...data,
      exportTypes: exportTypes(),
      notice:
        UNFINISHED_NOTICES[done] ||
        (PAYU_STATUSES.has(done.slice(5)) && done.startsWith("payu-")
          ? `PayU says this payment is "${done.slice(5)}", so nothing was saved.`
          : ""),
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// DAILY REPORT PDF
// ========================================
// Only downloads the PDF. The nightly scheduler emails the report.

exports.downloadDailyReport = async (req, res, next) => {
  try {
    const selectedDate = String(req.query.date || "").trim();

    if (!realDate(selectedDate)) {
      return res.status(400).render("pages/form-error", {
        message: "Please choose a valid report date.",
        backUrl: "/admin/dashboard",
      });
    }

    const report = await getDailyReport(selectedDate);
    const pdfBuffer = await generateDailyReportPdf(report);

    res.set("Content-Type", "application/pdf");
    res.attachment(`jbc-seva-daily-report-${selectedDate}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// CSV EXPORT
// ========================================

exports.exportCsv = async (req, res, next) => {
  try {
    const csv = await buildExport(req.params.type, req.query);

    if (csv === null) {
      return next();
    }

    const date = indiaDate(new Date());

    res.set("Content-Type", "text/csv; charset=utf-8");
    res.attachment(`jbc-${req.params.type}-${date}.csv`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
};

// ========================================
// LOGOUT
// ========================================

exports.logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("❌ Logout error:", error.message);
      return res.status(500).send("Unable to logout");
    }

    res.clearCookie("connect.sid");
    return res.redirect("/admin/login");
  });
};

// ========================================
// UNFINISHED PAYMENTS
// ========================================

// Only statuses PayU really reports are shown (the notice comes from the URL)
const PAYU_STATUSES = new Set([
  "failure",
  "failed",
  "pending",
  "in progress",
  "bounced",
  "dropped",
  "cancelled",
  "usercancelled",
  "not found",
  "unknown",
]);

const UNFINISHED_NOTICES = {
  saved: "PayU confirmed the payment. It is saved and the receipt has been emailed.",
  "save-failed":
    "PayU confirmed the payment, but it could not be saved. Check the server log.",
  closed: "Marked as checked. It no longer shows here.",
  gone: "This payment is no longer unfinished.",
  error:
    "Could not reach PayU, or PayU refused the request (check PAYU_KEY / PAYU_SALT). See the server log.",
};

const backToUnfinished = (res, done) =>
  res.redirect(`/admin/dashboard?view=unfinished&done=${encodeURIComponent(done)}`);

// Asks PayU about a payment whose callback never arrived and saves it
// if PayU says it succeeded
exports.verifyUnfinished = async (req, res) => {
  const txnid = String(req.params.txnid || "");
  try {
    const pending = await store.getPending(txnid);
    if (!pending) return backToUnfinished(res, "gone");

    const payu = await fetchPayUStatus(txnid);
    if (payu.status !== "success") {
      const status = PAYU_STATUSES.has(payu.status) ? payu.status : "unknown";
      return backToUnfinished(res, `payu-${status}`);
    }

    const isDonation = pending.type === "DONATION";
    const service = require(
      isDonation ? "../services/donationService" : "../services/membershipService",
    );
    const result = await service.processPaymentSuccess(
      {
        ...payu,
        txnid,
        status: "success",
        productinfo: isDonation ? "donation" : "membership",
      },
      { checkedWithPayU: true },
    );
    return backToUnfinished(res, result?.error ? "save-failed" : "saved");
  } catch (error) {
    console.error("❌ PayU verify failed:", error.message);
    return backToUnfinished(res, "error");
  }
};

// The admin checked it in the PayU dashboard (failed or abandoned)
exports.closeUnfinished = async (req, res, next) => {
  try {
    await store.deletePending(String(req.params.txnid || ""));
    return backToUnfinished(res, "closed");
  } catch (error) {
    return next(error);
  }
};
