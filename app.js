require("dotenv").config();

const express = require("express");
const session = require("express-session");

const {
  port,
  nodeEnv,
  appUrl,
  viewsDir,
  publicDir,
} = require("./config/appConfig");

const { trustEmail } = require("./config/emailConfig");

const trust = require("./config/trustConfig");

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing in .env");
}

const isProduction = nodeEnv === "production";

const {
  verifyEmailConnection,
} = require("./services/emailService");

const {
  startDailyReportScheduler,
} = require("./services/dailyReportScheduler");

const { startBackupScheduler } = require("./services/backupService");

const { startPledgeScheduler } = require("./services/pledgeService");

const { logGoLiveChecks } = require("./services/configCheck");

const notFound = require("./middleware/notFound");

const errorHandler = require("./middleware/errorHandler");

// ========================================
// APP
// ========================================

const app = express();

// Behind a proxy (Render, Nginx, etc.) so req.ip and secure cookies work
if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// ========================================
// SECURITY HEADERS
// ========================================

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });

  next();
});

// ========================================
// EJS CONFIGURATION
// ========================================

app.set("view engine", "ejs");

app.set("views", viewsDir);

// ========================================
// STATIC FILES
// ========================================

app.use(express.static(publicDir));

// ========================================
// BODY PARSER
// ========================================

app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.use(express.json());

// ========================================
// SESSION CONFIGURATION
// ========================================

app.use(
  session({
    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    // Active users stay logged in; 2 hours idle logs them out
    rolling: true,

    cookie: {
      httpOnly: true,

      secure: isProduction,

      sameSite: "lax",

      maxAge: 1000 * 60 * 60 * 2,
    },
  }),
);

// ========================================
// LANGUAGE (Hindi / English)
// ========================================

const { i18n } = require("./middleware/i18n");

app.use(i18n);

// ========================================
// VIEW LOCALS
// ========================================

app.use((req, res, next) => {
  res.locals.trust = trust;
  res.locals.currentUser = req.session.user || null;
  res.locals.isAdmin = req.session.isAdmin === true;
  res.locals.currentPath = req.path;
  res.locals.trustEmail = trustEmail || "";
  res.locals.appUrl = appUrl;
  // 10-digit Indian number for a "chat on WhatsApp" link, if set
  res.locals.trustWhatsapp = /^[6-9]\d{9}$/.test(process.env.TRUST_WHATSAPP || "") ? process.env.TRUST_WHATSAPP : "";
  res.locals.year = new Date().getFullYear();
  next();
});

// ========================================
// ROUTES
// ========================================

const donationRoutes = require("./routes/donationRoutes");

const donateRoutes = require("./routes/donateRoutes");

const medicalRoutes = require("./routes/medicalRoutes");

const adminRoutes = require("./routes/adminRoutes");

const webRoutes = require("./routes/webRoutes");

const systemRoutes = require("./routes/systemRoutes");

const userRoutes = require("./routes/userRoutes");

const enquiryRoutes = require("./routes/enquiryRoutes");

const contentRoutes = require("./routes/contentRoutes");

// ========================================
// DONATION ROUTES
// ========================================

app.use("/donation", donationRoutes);

app.use("/donate", donateRoutes);

// ========================================
// MEDICAL ROUTES
// ========================================

app.use("/medical", medicalRoutes);

// ========================================
// ADMIN ROUTES
// ========================================

app.use("/admin", adminRoutes);

// ========================================
// WEB ROUTES
// ========================================

app.use(webRoutes);

// ========================================
// USER ACCOUNT ROUTES
// ========================================

app.use(userRoutes);

// ========================================
// VOLUNTEER + CONTACT ROUTES
// ========================================

app.use(enquiryRoutes);

// ========================================
// UPDATES + EVENTS ROUTES
// ========================================

app.use(contentRoutes);

// ========================================
// SYSTEM ROUTES
// ========================================

app.use(systemRoutes);

// ========================================
// 404 HANDLER
// ========================================

app.use(notFound);

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use(errorHandler);

// ========================================
// START SERVER
// ========================================

if (require.main === module) {
  app.listen(port, async () => {
    console.log("");

    console.log("=================================");

    console.log(
      `🚀 Server running at http://localhost:${port}`,
    );

    console.log("=================================");

    console.log("");

    // ========================================
    // VERIFY EMAIL CONNECTION
    // ========================================

    await verifyEmailConnection();

    // ========================================
    // START DAILY REPORT SCHEDULER
    // ========================================

    startDailyReportScheduler();

    startBackupScheduler();

    startPledgeScheduler();

    logGoLiveChecks();
  });
}

// ========================================
// EXPORT APP
// ========================================

module.exports = app;