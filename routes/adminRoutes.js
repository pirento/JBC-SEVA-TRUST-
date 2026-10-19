const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");
const createRateLimiter = require("../middleware/rateLimit");

const loginLimiter = createRateLimiter();

router.get("/login", adminController.showLogin);

router.post(
  "/login",
  loginLimiter,
  adminController.login
);

router.get(
  "/dashboard",
  adminAuth,
  adminController.dashboard
);

// ========================================
// DAILY REPORT DOWNLOAD
// ========================================

router.get(
  "/report/download",
  adminAuth,
  adminController.downloadDailyReport
);

router.get(
  "/export/:type",
  adminAuth,
  adminController.exportCsv
);

router.post(
  "/logout",
  adminAuth,
  adminController.logout
);

module.exports = router;