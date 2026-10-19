const router = require("express").Router();
const controller = require("../controllers/medicalController");
const honeypot = require("../middleware/honeypot");
const createRateLimiter = require("../middleware/rateLimit");

// Each submit stores a pending record (or a PDF and an email); stop scripted floods
const submitLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
router.get("/", controller.showMedicalForm);
router.post("/", submitLimiter, honeypot, controller.submitMedical);
router.get("/success", controller.showMedicalSuccess);
router.get("/receipt/:fileName", controller.downloadReceipt);
module.exports = router;
