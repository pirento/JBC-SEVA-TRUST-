const donationService = require("../services/donationService");
const trust = require("../config/trustConfig");
const { appUrl } = require("../config/appConfig");

// Transaction ids are created by generateTxnId: TXN_<time>_<random>
const TXN_ID = /^TXN_[A-Za-z0-9_-]+$/;

const AMOUNT = /^\d{3,7}$/;

function findPage(field, value) {
  return trust.donationPages.find((page) => page[field] === value) || null;
}

// ============================================================
// DONATE PAGE (choose a cause)
// ============================================================

function showDonationForm(req, res) {
  // Old links used ?cause=<title>; send them to that cause's page
  if (req.query.cause) {
    const page = findPage("title", req.query.cause);

    if (page) {
      const amount = AMOUNT.test(String(req.query.amount || ""))
        ? `?amount=${req.query.amount}`
        : "";

      return res.redirect(`/donate/${page.slug}${amount}`);
    }
  }

  return res.render("pages/donate");
}

// ============================================================
// FORM FOR ONE CAUSE
// ============================================================

function renderCauseForm(res, page, { error = null, values = {}, status = 200 } = {}) {
  return res.status(status).render("pages/donate-cause", {
    page,
    error,
    values,
    title: `Donate to ${page.title}`,
  });
}

function showCauseForm(req, res, next) {
  const page = findPage("slug", req.params.slug);

  if (!page) {
    return next();
  }

  const { amount, purpose, monthly } = req.query;

  return renderCauseForm(res, page, {
    values: {
      amount: AMOUNT.test(String(amount || "")) ? amount : "",
      purpose: page.donation.purposes.includes(purpose) ? purpose : "",
      monthly: monthly === "1" ? "on" : "",
    },
  });
}

// ============================================================
// SUBMIT DONATION → PayU
// ============================================================

async function submitDonation(req, res) {
  const body = req.body || {};

  try {
    const result = await donationService.initiateDonation({
      ...body,
      lang: res.locals.lang,
    });

    return res.render("pages/payu-redirect", { ...result, kind: "Donation" });
  } catch (error) {
    console.error("❌ Donation submission error:", error.message);

    const page = findPage("title", body.cause) || trust.donationPages[0];

    return renderCauseForm(res, page, {
      error: error.expose
        ? error.message
        : "Something went wrong on our side. Please try again in a few minutes, or contact the trust.",
      values: body,
      status: 400,
    });
  }
}

// ============================================================
// PAYU CALLBACKS
// ============================================================
// PayU posts here from its own site. After saving, the browser is sent
// to a normal GET page, so refreshing never re-posts the payment and the
// donor's login cookie (SameSite=Lax) is sent again.

async function paymentSuccess(req, res) {
  try {
    const result = await donationService.processPaymentSuccess(req.body || {});

    if (result.failure) {
      return paymentFailure(req, res);
    }

    if (result.error) {
      return res.status(result.status || 400).render("pages/form-error", {
        message: result.error,
        backUrl: "/donate",
      });
    }

    return res.redirect(
      303,
      `/donate/thank-you/${encodeURIComponent(result.transactionId)}`,
    );
  } catch (error) {
    console.error("❌ Donation payment processing failed:", error.message);

    return res.status(500).render("pages/form-error", {
      message:
        "Payment was received, but donation processing failed. Please contact the Trust with your transaction ID.",
      backUrl: "/",
    });
  }
}

async function paymentFailure(req, res) {
  try {
    const result = await donationService.processPaymentFailure(req.body || {});
    const page = findPage("title", result.donation?.cause);
    const query = new URLSearchParams();

    if (TXN_ID.test(result.transactionId)) query.set("txn", result.transactionId);
    if (page) query.set("cause", page.slug);

    return res.redirect(303, `/donate/payment-failed?${query}`);
  } catch (error) {
    console.error("❌ Donation failure handling failed:", error.message);
    return res.redirect(303, "/donate/payment-failed");
  }
}

// ============================================================
// RESULT PAGES
// ============================================================

async function showThankYou(req, res, next) {
  try {
    const transactionId = String(req.params.transactionId || "");
    const donation = TXN_ID.test(transactionId)
      ? await donationService.findDonation(transactionId)
      : null;

    if (!donation) {
      return next();
    }

    const page = findPage("title", donation.cause);
    const amount = Number(donation.amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const certificateUrl = `/donate/certificate/${encodeURIComponent(transactionId)}`;

    return res.render("pages/thank-you", {
      name: donation.donorName,
      headline: `Your donation to ${donation.cause || trust.GENERAL_CAUSE} has been received.`,
      rows: [
        ["Amount", `₹${amount}`],
        ["Donated for", donation.cause],
        ["Purpose", donation.purpose],
        [
          "Dedication",
          donation.dedicatedTo
            ? `${donation.dedicationType} ${donation.dedicatedTo}`
            : "",
        ],
        ["Preferred seva date", donation.sevaDate],
        ["Monthly", donation.monthly ? "Yes, we will remind you each month" : ""],
        ["Payment mode", donation.paymentMode],
        ["Transaction ID", transactionId],
      ],
      certificateUrl,
      certificateLabel: "Download Certificate",
      selfText: `My donation receipt from JBC Seva Trust (${donation.cause}, Rs. ${amount}, Txn ${transactionId}): ${appUrl}${certificateUrl}`,
      shareText: `I just supported ${donation.cause} at JBC Seva Trust, Basti. You can help too: ${appUrl}/donate${page ? `/${page.slug}` : ""}`,
    });
  } catch (error) {
    return next(error);
  }
}

function showPaymentFailed(req, res) {
  const page = findPage("slug", req.query.cause);
  const transactionId = TXN_ID.test(String(req.query.txn || "")) ? req.query.txn : "";

  return res.render("pages/payment-failed", {
    transactionId,
    retryUrl: page ? `/donate/${page.slug}` : "/donate",
  });
}

// ============================================================
// CERTIFICATE DOWNLOAD
// ============================================================

async function downloadCertificate(req, res, next) {
  try {
    const transactionId = String(req.params.transactionId || "");

    if (!TXN_ID.test(transactionId)) {
      return res.status(400).send("Invalid transaction ID.");
    }

    const filePath = await donationService.getCertificatePath(transactionId);

    if (!filePath) {
      return res.status(404).send("Donation certificate not found.");
    }

    res.set("Cache-Control", "no-store");
    return res.download(filePath, `donation-certificate-${transactionId}.pdf`);
  } catch (error) {
    return next(error);
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  showDonationForm,
  showCauseForm,
  submitDonation,
  paymentSuccess,
  paymentFailure,
  showThankYou,
  showPaymentFailed,
  downloadCertificate,
};
