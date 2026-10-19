const membershipService = require("../services/membershipService");

// ============================================================
// SHOW MEMBERSHIP FORM
// ============================================================

function showMembershipForm(req, res) {
  return res.render("pages/donation");
}

// ============================================================
// SUBMIT MEMBERSHIP FORM
// ============================================================

async function submitMembership(req, res) {
  try {
    const body = req.body || {};
    const amount = Number(body.amount);

    // --------------------------------------------------------
    // Validate member name
    // --------------------------------------------------------

    const memberName = String(body.memberName || "").trim();

    if (!memberName) {
      return res.status(400).render("pages/form-error", {
        message: "Please provide the member name.",
        backUrl: "/donation",
      });
    }

    if (memberName.length > 100) {
      return res.status(400).render("pages/form-error", {
        message: "Member name cannot exceed 100 characters.",
        backUrl: "/donation",
      });
    }

    // --------------------------------------------------------
    // Validate amount
    //
    // Minimum membership amount = ₹100
    //
    // ₹100 - ₹10,999  -> 1 Year Member
    // ₹11,000+        -> Lifetime Member
    // --------------------------------------------------------

    if (!Number.isFinite(amount) || amount < 100) {
      return res.status(400).render("pages/form-error", {
        message: "Minimum membership amount is ₹100.",
        backUrl: "/donation",
      });
    }

    // --------------------------------------------------------
    // Normalize membership data
    // --------------------------------------------------------

    const membershipData = {
      ...body,
      memberName,
      amount,
    };

    // --------------------------------------------------------
    // Existing PayU/payment flow
    // --------------------------------------------------------

    const result =
      await membershipService.initiateMembership(membershipData);

    return res.render("pages/payu-payment", result);
  } catch (error) {
    console.error(
      "❌ Membership submission error:",
      error.message
    );

    return res.status(400).render("pages/form-error", {
      message: error.message,
      backUrl: "/donation",
    });
  }
}

// ============================================================
// PAYMENT SUCCESS
// ============================================================

async function paymentSuccess(req, res) {
  try {
    const data = req.body || {};

    console.log("\n=================================");
    console.log("✅ PAYU PAYMENT SUCCESS");
    console.log("Transaction:", data.txnid);
    console.log("Amount:", data.amount);
    console.log("Status:", data.status);
    console.log("Email:", data.email);
    console.log("=================================");

    const result =
      await membershipService.processPaymentSuccess(data);

    if (result.failure) {
      return paymentFailure(req, res);
    }

    if (result.error) {
      return res
        .status(result.status || 400)
        .render("pages/form-error", {
          message: result.error,
          backUrl: "/",
        });
    }

    return res.render(
      "pages/donation-success",
      result
    );
  } catch (error) {
    console.error(
      "❌ PAYMENT SUCCESS PROCESSING FAILED:",
      error.message
    );

    return res.status(500).render("pages/form-error", {
      message:
        "Payment was received, but membership certificate processing failed. Please contact the Trust.",
      backUrl: "/",
    });
  }
}

// ============================================================
// PAYMENT FAILURE
// ============================================================

async function paymentFailure(req, res) {
  try {
    const result =
      await membershipService.processPaymentFailure(req.body || {});

    console.log("\n=================================");
    console.log("❌ PAYU PAYMENT FAILED");
    console.log("Transaction:", result.transactionId);
    console.log("Error:", result.errorMessage);
    console.log("=================================");

    return res.render(
      "pages/donation-failure",
      result
    );
  } catch (error) {
    console.error(
      "❌ Payment failure error:",
      error.message
    );

    return res.status(500).render("pages/form-error", {
      message: "Payment failed. Please try again.",
      backUrl: "/",
    });
  }
}

// ============================================================
// DOWNLOAD MEMBERSHIP CERTIFICATE
// ============================================================

async function downloadReceipt(req, res) {
  try {
    let transactionId = String(
      req.params.transactionId || ""
    ).trim();

    // --------------------------------------------------------
    // Decode URL safely
    // --------------------------------------------------------

    try {
      transactionId = decodeURIComponent(transactionId);
    } catch {
      return res
        .status(400)
        .send("Invalid certificate URL.");
    }

    // --------------------------------------------------------
    // Support old/new certificate prefixes
    // --------------------------------------------------------

    transactionId = transactionId
      .replace(/^donation-receipt-/i, "")
      .replace(/^membership-certificate-/i, "")
      .replace(/\.pdf$/i, "");

    // --------------------------------------------------------
    // Validate transaction ID
    // --------------------------------------------------------

    if (!/^TXN_[A-Za-z0-9_-]+$/.test(transactionId)) {
      return res
        .status(400)
        .send("Invalid transaction ID.");
    }

    // --------------------------------------------------------
    // Generate / retrieve certificate
    // --------------------------------------------------------

    const receipt =
      await membershipService.getReceipt(transactionId);

    res.status(200);

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${receipt.fileName}"`
    );

    res.setHeader(
      "Content-Length",
      receipt.pdfBuffer.length
    );

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    return res.end(receipt.pdfBuffer);
  } catch (error) {
    console.error(
      "❌ CERTIFICATE DOWNLOAD FAILED:",
      error.message
    );

    if (!res.headersSent) {
      return res
        .status(error.status || 500)
        .send(
          error.status === 404
            ? error.message
            : "Unable to generate membership certificate."
        );
    }
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  showMembershipForm,
  submitMembership,
  paymentSuccess,
  paymentFailure,
  downloadReceipt,
};