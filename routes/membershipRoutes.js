const router = require("express").Router();

const controller = require("../controllers/membershipController");
const honeypot = require("../middleware/honeypot");
const createRateLimiter = require("../middleware/rateLimit");

// Each submit stores a pending record (or a PDF and an email); stop scripted floods
const submitLimiter = createRateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });

// Membership lives under /donation (URL kept for PayU callback settings)

router.get("/", controller.showMembershipForm);
router.post("/", submitLimiter, honeypot, controller.submitMembership);

// PayU callbacks
router.post("/success", controller.paymentSuccess);
router.post("/failure", controller.paymentFailure);

// Result pages and certificate
router.get("/thank-you/:transactionId", controller.showThankYou);
router.get("/payment-failed", controller.showPaymentFailed);
router.get("/receipt/:transactionId", controller.downloadReceipt);

module.exports = router;
