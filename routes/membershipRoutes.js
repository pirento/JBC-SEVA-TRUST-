const router = require("express").Router();

const controller = require("../controllers/membershipController");

// Membership lives under /donation (URL kept for PayU callback settings)

router.get("/", controller.showMembershipForm);
router.post("/", controller.submitMembership);

// PayU callbacks
router.post("/success", controller.paymentSuccess);
router.post("/failure", controller.paymentFailure);

// Result pages and certificate
router.get("/thank-you/:transactionId", controller.showThankYou);
router.get("/payment-failed", controller.showPaymentFailed);
router.get("/receipt/:transactionId", controller.downloadReceipt);

module.exports = router;
