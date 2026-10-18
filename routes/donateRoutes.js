const router = require("express").Router();

const controller = require("../controllers/donateController");

// ========================================
// DONATION PAYMENT
// ========================================

// Donation form page
router.get(
  "/",
  controller.showDonationForm
);

// Download donation certificate (before /:slug so it is not taken as a cause)
router.get(
  "/certificate/:transactionId",
  controller.downloadCertificate
);

// Donation form for one cause, e.g. /donate/temple
router.get(
  "/:slug",
  controller.showCauseForm
);

// Start donation payment
router.post(
  "/",
  controller.submitDonation
);

// PayU successful payment callback
router.post(
  "/success",
  controller.paymentSuccess
);

// PayU failed payment callback
router.post(
  "/failure",
  controller.paymentFailure
);

module.exports = router;