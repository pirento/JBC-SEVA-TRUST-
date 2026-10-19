require("dotenv").config();

// The trust works in India: dates on certificates, reports and the
// financial year (April to March) follow Indian time on any host
process.env.TZ = "Asia/Kolkata";

const express = require("express");
const session = require("express-session");
const compression = require("compression");
const MemoryStore = require("memorystore")(session);

const { port, nodeEnv, appUrl, viewsDir, publicDir } = require("./config/appConfig");

const { trustEmail } = require("./config/emailConfig");

const trust = require("./config/trustConfig");

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing in .env");
}

const isProduction = nodeEnv === "production";

// A short secret lets anyone forge a login cookie; refuse to go live with one
if (isProduction && process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters in production");
}

const { verifyEmailConnection } = require("./services/emailService");

const { startDailyReportScheduler } = require("./services/dailyReportScheduler");

const { startBackupScheduler } = require("./services/backupService");

const { startPledgeScheduler } = require("./services/pledgeService");

const { logGoLiveChecks } = require("./services/configCheck");

const notFound = require("./middleware/notFound");

const errorHandler = require("./middleware/errorHandler");

// ========================================
// APP
// ========================================

const app = express();

// Behind a proxy (Render, Nginx, etc.) so req.ip and secure cookies work.
// TRUST_PROXY = number of proxies in front (2 for Cloudflare + Render)
if (isProduction) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
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
// COMPRESSION
// ========================================
// Pages are mostly text; gzip makes them several times smaller on
// slow mobile connections.

app.use(compression());

// ========================================
// STATIC FILES
// ========================================
// Images and fonts rarely change; CSS and JS are re-checked hourly.

app.use(
  express.static(publicDir, {
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (/\.(png|jpe?g|webp|svg|ico|ttf|woff2?)$/.test(filePath)) {
        res.set("Cache-Control", "public, max-age=604800");
      }
    },
  }),
);

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

    // With MongoDB, sessions are kept there (a restart no longer logs
    // everyone out); otherwise in memory. Both remove expired sessions.
    store: process.env.MONGODB_URI
      ? require("connect-mongo").create({
          clientPromise: require("./models/mongoStore").getClient(),
          dbName: require("./models/mongoStore").DB_NAME,
          collectionName: "sessions",
          ttl: 2 * 60 * 60,
        })
      : new MemoryStore({ checkPeriod: 1000 * 60 * 15 }),

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

const userModel = require("./models/userModel");

// A session from before the password was last changed or reset is
// logged out on every page, so it cannot show or pre-fill the owner's details
app.use(async (req, res, next) => {
  const sessionUser = req.session.user;
  if (!sessionUser) return next();

  try {
    const user = await userModel.findByEmail(sessionUser.email);
    if (
      !user ||
      (Number(user.passwordChangedAt) || 0) !== sessionUser.passwordChangedAt
    ) {
      delete req.session.user;
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

// Behind Cloudflare with TRUST_PROXY unset, every visitor would share
// one IP for rate limits; say so once in the log
let proxyWarned = !isProduction || Boolean(process.env.TRUST_PROXY);
app.use((req, res, next) => {
  if (!proxyWarned && req.get("cf-connecting-ip")) {
    proxyWarned = true;
    console.warn(
      "⚠️  Cloudflare detected: set TRUST_PROXY=2 in .env so visitors are told apart",
    );
  }
  next();
});

app.use((req, res, next) => {
  res.locals.trust = trust;
  res.locals.currentUser = req.session.user || null;
  res.locals.isAdmin = req.session.isAdmin === true;
  res.locals.currentPath = req.path;
  res.locals.trustEmail = trustEmail || "";
  res.locals.appUrl = appUrl;
  res.locals.trustWhatsapp = trust.phone;
  res.locals.year = new Date().getFullYear();
  next();
});

// ========================================
// FORMS ONLY FROM THIS SITE
// ========================================

app.use(require("./middleware/sameOrigin"));

// ========================================
// ROUTES
// ========================================

const membershipRoutes = require("./routes/membershipRoutes");

const donationRoutes = require("./routes/donationRoutes");

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

app.use("/donation", membershipRoutes);

app.use("/donate", donationRoutes);

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
  // Without its database the site cannot work: stop with a clear message
  // (pm2 starts it again) instead of running half-broken
  if (process.env.MONGODB_URI) {
    require("./models/mongoStore")
      .getClient()
      .then(() => console.log("✅ MongoDB connected"))
      .catch((error) => {
        console.error("❌ MongoDB connection failed:", error.message);
        process.exit(1);
      });
  }

  // Log a stray async error instead of letting it stop the whole site
  process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled error:", error?.stack || error);
  });

  const server = app.listen(port, () => {
    console.log("");

    console.log("=================================");

    console.log(`🚀 Server running at http://localhost:${port}`);

    console.log("=================================");

    console.log("");

    // ========================================
    // SCHEDULERS (daily report, backup, monthly reminders)
    // ========================================

    startDailyReportScheduler();

    startBackupScheduler();

    startPledgeScheduler();

    logGoLiveChecks();

    // ========================================
    // VERIFY EMAIL CONNECTION
    // ========================================
    // Not awaited: a slow or blocked mail server must not hold up the rest

    verifyEmailConnection();
  });

  // pm2 / the host sends SIGTERM on restart: finish open requests first,
  // then close the database connection
  process.on("SIGTERM", () =>
    server.close(async () => {
      if (process.env.MONGODB_URI) await require("./models/mongoStore").closeDatabase();
      process.exit(0);
    }),
  );
}

// ========================================
// EXPORT APP
// ========================================

module.exports = app;
