const router = require("express").Router();

const controller = require("../controllers/donationController");

// ========================================
// DONATION PAGES
// ========================================

router.get("/", controller.showDonationForm);

// Fixed paths come before /:slug so they are not taken as a cause
router.get("/thank-you/:transactionId", controller.showThankYou);
router.get("/payment-failed", controller.showPaymentFailed);
router.get("/certificate/:transactionId", controller.downloadCertificate);

// Form for one cause, e.g. /donate/temple
router.get("/:slug", controller.showCauseForm);

// ========================================
// PAYMENT
// ========================================

router.post("/", controller.submitDonation);

// PayU callbacks (browser returns here from PayU)
router.post("/success", controller.paymentSuccess);
router.post("/failure", controller.paymentFailure);

module.exports = router;
