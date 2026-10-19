const { authenticateAdmin } = require("../services/adminAuthService");
const { getDailyReport } = require("../services/adminReportService");
const { generateDailyReportPdf } = require("../services/adminReportPdfService");
const { getDashboard } = require("../services/adminDashboardService");
const { buildExport, exportTypes } = require("../services/exportService");

// ========================================
// SHOW ADMIN LOGIN
// ========================================

exports.showLogin = (req, res) => {
  if (req.session && req.session.isAdmin === true) {
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
    req.session.adminLoginTime = new Date().toISOString();

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
    });

    return res.render("admin/dashboard", { ...data, exportTypes });
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

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ||
      Number.isNaN(Date.parse(selectedDate))
    ) {
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

    const date = new Date().toISOString().slice(0, 10);

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
