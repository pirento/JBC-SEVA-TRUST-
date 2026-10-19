const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");
const createRateLimiter = require("../middleware/rateLimit");

const loginLimiter = createRateLimiter();

router.get("/login", adminController.showLogin);

router.post("/login", loginLimiter, adminController.login);

router.get("/dashboard", adminAuth, adminController.dashboard);

// ========================================
// DAILY REPORT DOWNLOAD
// ========================================

router.get("/report/download", adminAuth, adminController.downloadDailyReport);

router.get("/export/:type", adminAuth, adminController.exportCsv);

// Updates (with photo) and events
const content = require("../controllers/contentController");
const { handlePhoto } = require("../middleware/upload");

router.get("/content", adminAuth, content.adminContent);
router.post("/updates", adminAuth, handlePhoto, content.createUpdate);
router.post("/updates/:id/delete", adminAuth, content.deleteUpdate);
router.post("/events", adminAuth, content.createEvent);
router.post("/events/:id/delete", adminAuth, content.deleteEvent);

// Accounts: search, password reset link, new login details
const users = require("../controllers/adminUsersController");

router.get("/users", adminAuth, users.list);
router.post("/users/reset", adminAuth, users.sendReset);
router.post("/users/login-details", adminAuth, users.sendLoginDetails);

// Correct what a donor, member or patient typed (history is kept)
const records = require("../controllers/adminRecordsController");

router.get("/records/:kind/:id/edit", adminAuth, records.show);
router.post("/records/:kind/:id/edit", adminAuth, records.save);

router.post("/logout", adminAuth, adminController.logout);

module.exports = router;
