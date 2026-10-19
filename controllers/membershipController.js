const membershipService = require("../services/membershipService");
const { appUrl } = require("../config/appConfig");

// Transaction ids are created by generateTxnId: TXN_<time>_<random>
const TXN_ID = /^TXN_[A-Za-z0-9_-]+$/;

// ============================================================
// MEMBERSHIP FORM
// ============================================================

function showMembershipForm(req, res) {
  return res.render("pages/donation", { error: null, values: {} });
}

async function submitMembership(req, res) {
  const body = req.body || {};

  try {
    // The service checks every field (name, phone, email, amount, consent)
    const result = await membershipService.initiateMembership(body);

    return res.render("pages/payu-redirect", { ...result, kind: "Membership" });
  } catch (error) {
    console.error("❌ Membership submission error:", error.message);

    return res.status(400).render("pages/donation", {
      error: error.message,
      values: body,
    });
  }
}

// ============================================================
// PAYU CALLBACKS
// ============================================================
// After saving, the browser is redirected to a GET page so a refresh
// never re-posts the payment.

async function paymentSuccess(req, res) {
  try {
    const result = await membershipService.processPaymentSuccess(req.body || {});

    if (result.failure) {
      return paymentFailure(req, res);
    }

    if (result.error) {
      return res.status(result.status || 400).render("pages/form-error", {
        message: result.error,
        backUrl: "/donation",
      });
    }

    const transactionId = result.transactionId || (req.body || {}).txnid;

    return res.redirect(303, `/donation/thank-you/${encodeURIComponent(transactionId)}`);
  } catch (error) {
    console.error("❌ Membership payment processing failed:", error.message);

    return res.status(500).render("pages/form-error", {
      message:
        "Payment was received, but membership processing failed. Please contact the Trust with your transaction ID.",
      backUrl: "/",
    });
  }
}

async function paymentFailure(req, res) {
  try {
    const result = await membershipService.processPaymentFailure(req.body || {});
    const query = TXN_ID.test(String(result.transactionId)) ? `?txn=${result.transactionId}` : "";

    return res.redirect(303, `/donation/payment-failed${query}`);
  } catch (error) {
    console.error("❌ Membership failure handling failed:", error.message);
    return res.redirect(303, "/donation/payment-failed");
  }
}

// ============================================================
// RESULT PAGES
// ============================================================

async function showThankYou(req, res, next) {
  try {
    const transactionId = String(req.params.transactionId || "");
    const membership = TXN_ID.test(transactionId)
      ? await membershipService.findMembership(transactionId)
      : null;

    if (!membership) {
      return next();
    }

    const amount = Number(membership.amount || 0).toFixed(2);
    const certificateUrl = `/donation/receipt/${encodeURIComponent(transactionId)}`;
    const name = membership.memberName || membership.donorName || "Member";

    return res.render("pages/thank-you", {
      name,
      headline: "Welcome to JBC Seva Trust. Your membership is confirmed.",
      rows: [
        ["Membership", membership.membershipType],
        ["Amount", `₹${amount}`],
        ["Payment mode", membership.paymentMode],
        ["Transaction ID", transactionId],
      ],
      certificateUrl,
      certificateLabel: "Download Membership Certificate",
      selfText: `My JBC Seva Trust membership certificate: ${appUrl}${certificateUrl}`,
    });
  } catch (error) {
    return next(error);
  }
}

function showPaymentFailed(req, res) {
  return res.render("pages/payment-failed", {
    transactionId: TXN_ID.test(String(req.query.txn || "")) ? req.query.txn : "",
    retryUrl: "/donation",
  });
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
  showThankYou,
  showPaymentFailed,
  downloadReceipt,
};