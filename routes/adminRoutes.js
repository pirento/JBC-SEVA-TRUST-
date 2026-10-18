const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");

router.get("/login", adminController.showLogin);

router.post(
  "/login",
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

router.post(
  "/logout",
  adminAuth,
  adminController.logout
);

module.exports = router;