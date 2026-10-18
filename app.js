require("dotenv").config();

const express = require("express");
const session = require("express-session");

const {
  port,
  viewsDir,
  publicDir,
} = require("./config/appConfig");

const {
  verifyEmailConnection,
} = require("./services/emailService");

const {
  startDailyReportScheduler,
} = require("./services/dailyReportScheduler");

const notFound = require("./middleware/notFound");

const errorHandler = require("./middleware/errorHandler");

// ========================================
// APP
// ========================================

const app = express();

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

    cookie: {
      httpOnly: true,

      secure: false,

      sameSite: "lax",

      maxAge: 1000 * 60 * 60,
    },
  }),
);

// ========================================
// ROUTES
// ========================================

const donationRoutes = require("./routes/donationRoutes");

const donateRoutes = require("./routes/donateRoutes");

const medicalRoutes = require("./routes/medicalRoutes");

const adminRoutes = require("./routes/adminRoutes");

const webRoutes = require("./routes/webRoutes");

const systemRoutes = require("./routes/systemRoutes");

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
  });
}

// ========================================
// EXPORT APP
// ========================================

module.exports = app;