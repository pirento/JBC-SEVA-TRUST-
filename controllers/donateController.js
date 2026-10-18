const fs = require("fs");
const path = require("path");

const donateService = require("../services/donateService");
const store = require("../models/pendingDonationStore");


// ============================================================
// SHOW DONATION FORM
// ============================================================

function showDonationForm(req, res) {
  return res.render("pages/donate", {
    selectedCause: String(req.query.cause || ""),
  });
}


// ============================================================
// SUBMIT DONATION
// ============================================================

async function submitDonation(req, res) {
  try {
    const body = req.body || {};

    const result =
      await donateService.initiateDonation(body);

    // Donation uses its own PayU payment page.
    // Membership continues using pages/payu-payment.
    return res.render(
      "pages/donate-payu-payment",
      result
    );

  } catch (error) {
    console.error(
      "❌ Donation submission error:",
      error.message
    );

    return res.status(400).render(
      "pages/form-error",
      {
        message: error.message,
        backUrl: "/donate",
      }
    );
  }
}


// ============================================================
// PAYMENT SUCCESS
// ============================================================

async function paymentSuccess(req, res) {
  try {
    const data = req.body || {};

    console.log("");
    console.log("=================================");
    console.log("✅ PAYU DONATION PAYMENT SUCCESS");
    console.log("Transaction:", data.txnid);
    console.log("Amount:", data.amount);
    console.log("Status:", data.status);
    console.log("Email:", data.email);
    console.log("=================================");

    const result =
      await donateService.processPaymentSuccess(
        data
      );

    if (result.failure) {
      return paymentFailure(req, res);
    }

    if (result.error) {
      return res.status(
        result.status || 400
      ).render(
        "pages/form-error",
        {
          message: result.error,
          backUrl: "/",
        }
      );
    }

    return res.render(
      "pages/donation-payment-success",
      result
    );

  } catch (error) {
    console.error(
      "❌ DONATION PAYMENT PROCESSING FAILED:",
      error.message
    );

    return res.status(500).render(
      "pages/form-error",
      {
        message:
          "Payment was received, but donation processing failed. Please contact the Trust.",
        backUrl: "/",
      }
    );
  }
}


// ============================================================
// PAYMENT FAILURE
// ============================================================

async function paymentFailure(req, res) {
  try {
    const result =
      await donateService.processPaymentFailure(
        req.body || {}
      );

    console.log("");
    console.log("=================================");
    console.log("❌ PAYU DONATION PAYMENT FAILED");
    console.log(
      "Transaction:",
      result.transactionId
    );
    console.log(
      "Error:",
      result.errorMessage
    );
    console.log("=================================");

    return res.render(
      "pages/donation-payment-failure",
      result
    );

  } catch (error) {
    console.error(
      "❌ Donation payment failure error:",
      error.message
    );

    return res.status(500).render(
      "pages/form-error",
      {
        message:
          "Donation payment failed. Please try again.",
        backUrl: "/",
      }
    );
  }
}


// ============================================================
// DOWNLOAD DONATION CERTIFICATE
// ============================================================

function downloadCertificate(req, res) {
  try {
    const transactionId =
      String(
        req.params.transactionId || ""
      ).trim();

    if (!transactionId) {
      return res.status(400).send(
        "Transaction ID is required."
      );
    }

    if (!/^TXN_[A-Za-z0-9_-]+$/.test(transactionId)) {
      return res.status(400).send(
        "Invalid transaction ID."
      );
    }


    // --------------------------------------------------------
    // FIRST: Try receipt stored in memory
    // --------------------------------------------------------

    const receipt =
      store.getReceipt(transactionId);

    let certificatePath = null;

    if (receipt) {
      certificatePath =
        receipt.certificatePath ||
        receipt.path ||
        receipt.filePath;
    }


    // --------------------------------------------------------
    // SECOND: If receipt is not in memory,
    // directly locate the generated PDF.
    // --------------------------------------------------------

    if (!certificatePath) {
      certificatePath = path.join(
        __dirname,
        "..",
        "data",
        "receipts",
        `donation-certificate-${transactionId}.pdf`
      );
    }


    // --------------------------------------------------------
    // CHECK FILE
    // --------------------------------------------------------

    if (!fs.existsSync(certificatePath)) {
      console.error(
        "❌ Donation certificate not found:",
        certificatePath
      );

      return res.status(404).send(
        "Donation certificate file not found."
      );
    }


    // --------------------------------------------------------
    // DOWNLOAD
    // --------------------------------------------------------

    const fileName =
      `donation-certificate-${transactionId}.pdf`;

    console.log(
      "📥 Downloading donation certificate:",
      certificatePath
    );

    return res.download(
      certificatePath,
      fileName,
      (error) => {
        if (error) {
          console.error(
            "❌ Certificate download failed:",
            error.message
          );

          if (!res.headersSent) {
            return res.status(500).send(
              "Unable to download donation certificate."
            );
          }
        }
      }
    );

  } catch (error) {
    console.error(
      "❌ Donation certificate download error:",
      error.message
    );

    return res.status(500).send(
      "Unable to download donation certificate."
    );
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  showDonationForm,
  submitDonation,
  paymentSuccess,
  paymentFailure,
  downloadCertificate,
};