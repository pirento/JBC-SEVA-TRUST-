const router = require("express").Router();

const controller = require("../controllers/donateController");

// ========================================
// DONATION PAYMENT
// ========================================

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

// ========================================
// DONATION CERTIFICATE
// ========================================

// Download donation certificate
router.get(
  "/certificate/:transactionId",
  controller.downloadCertificate
);

module.exports = router;