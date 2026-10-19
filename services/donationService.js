const fs = require("fs");
const path = require("path");

const { dataDir } = require("../config/appConfig");
const {
  generateTxnId,
  createPaymentData,
  verifyResponseHash,
  verifyPaymentAmount,
  PAYU_PAYMENT_URL,
} = require("./payuService");

const {
  PAYU_DONATION_SUCCESS_URL,
  PAYU_DONATION_FAILURE_URL,
} = require("../config/payuConfig");

const donationModel = require("../models/donationModel");
const store = require("../models/pendingPaymentStore");

const {
  required,
  phone,
  email,
  positiveAmount,
  accepted,
  personName,
  fewLinks,
} = require("../utils/validation");

const {
  donationPages,
  dedicationTypes,
  GENERAL_CAUSE,
} = require("../config/trustConfig");

const {
  generateDonationCertificate,
} = require("./donationCertificateService");

const {
  sendDonationCertificateEmail,
} = require("./donationEmailService");

// =========================================================
// VALIDATE DONATION
// =========================================================

function validateDonation(input) {
  const donorName =
    String(input.donorName || "").trim();

  const phoneNumber =
    String(input.phoneNumber || "").trim();

  const cleanEmail =
    String(input.email || "").trim();

  const amount =
    Number(input.amount);

  const paymentMode =
    String(input.paymentMode || "").trim();

  const message =
    String(input.message || "").trim();

  const page =
    donationPages.find((p) => p.title === input.cause) ||
    donationPages[0];

  const cause = page.title;

  if (!required(donorName)) {
    throw new Error("Donor name is required.");
  }

  if (donorName.length > 100) {
    throw new Error(
      "Donor name cannot exceed 100 characters."
    );
  }

  if (!personName(donorName)) {
    throw new Error("Please enter a valid name.");
  }

  if (!fewLinks(input.message, 0)) {
    throw new Error("Links are not allowed in the message.");
  }

  if (!phone(phoneNumber)) {
    throw new Error(
      "Phone number must be 10 digits."
    );
  }

  if (!required(cleanEmail)) {
    throw new Error("Email is required.");
  }

  if (!email(cleanEmail)) {
    throw new Error(
      "Please enter a valid email address."
    );
  }

  if (!positiveAmount(amount)) {
    throw new Error(
      "Donation amount must be greater than 0."
    );
  }

  if (amount < 100) {
    throw new Error(
      "Minimum donation amount is ₹100."
    );
  }

  // Catches typing mistakes (an extra zero); large gifts go through the trust directly
  if (amount > 1000000) {
    throw new Error(
      "For amounts above ₹10,00,000 please contact the Trust directly."
    );
  }

  if (!required(paymentMode)) {
    throw new Error(
      "Payment mode is required."
    );
  }

  if (paymentMode === "Cash") {
    throw new Error(
      "Cash payment is not available through online PayU payment."
    );
  }

  if (!accepted(input.consent)) {
    throw new Error(
      "Please accept the Terms, Privacy Policy and Refund Policy."
    );
  }

  return {
    donorName,
    phoneNumber,
    email: cleanEmail,
    amount,
    paymentMode,
    message,
    cause,
    ...validateDonationDetails(page, input),
  };
}

// =========================================================
// CAUSE-SPECIFIC DETAILS (purpose, dedication, seva date...)
// =========================================================

function validateDonationDetails(page, input) {
  const options = page.donation;
  const text = (value) => String(value || "").trim();

  const purpose = text(input.purpose);

  if (!options.purposes.includes(purpose)) {
    throw new Error(
      `Please choose what your donation for ${page.title} should be used for.`
    );
  }

  const dedicationType = text(input.dedicationType);
  const dedicatedTo = text(input.dedicatedTo);

  if (dedicationType && !dedicationTypes.includes(dedicationType)) {
    throw new Error("Please choose a valid dedication.");
  }

  if (dedicationType && !dedicatedTo) {
    throw new Error(`Please enter the name or occasion for "${dedicationType}".`);
  }

  if (dedicatedTo.length > 100) {
    throw new Error("Dedication cannot exceed 100 characters.");
  }

  let sevaDate = "";

  if (options.sevaDate && text(input.sevaDate)) {
    sevaDate = text(input.sevaDate);
    const date = new Date(`${sevaDate}T00:00:00Z`);
    const today = new Date(new Date().toISOString().slice(0, 10));
    const yearAhead = new Date(today.getTime() + 366 * 24 * 60 * 60 * 1000);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(sevaDate) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== sevaDate ||
      date < today ||
      date > yearAhead
    ) {
      throw new Error("Seva date must be a valid date within the next year.");
    }
  }

  const gotra = options.gotra ? text(input.gotra) : "";

  if (gotra.length > 50) {
    throw new Error("Gotra cannot exceed 50 characters.");
  }

  const address = text(input.address);

  if (address.length > 300) {
    throw new Error("Address cannot exceed 300 characters.");
  }

  const pan = text(input.pan).toUpperCase();

  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    throw new Error("Please enter a valid 10 character PAN, or leave it empty.");
  }

  return {
    purpose,
    dedicationType: dedicatedTo ? dedicationType : "",
    dedicatedTo: dedicationType ? dedicatedTo : "",
    sevaDate,
    gotra,
    pan,
    address,
    monthly: input.monthly === "on" || input.monthly === "true",
  };
}

// =========================================================
// INITIATE DONATION
// =========================================================

async function initiateDonation(input) {
  const donation =
    validateDonation(input);

  const txnid =
    generateTxnId();

  const paymentData =
    createPaymentData({
      txnid,

      amount:
        donation.amount.toFixed(2),

      firstname:
        donation.donorName,

      email:
        donation.email,

      phone:
        donation.phoneNumber,

      productinfo:
        "Donation",

      udf1:
        "DONATION",

      udf2:
        donation.paymentMode,

      udf3:
        donation.message,

      udf4:
        donation.cause,

      udf5:
        donation.purpose,

      // Donation gets separate PayU callbacks.
      surl:
        PAYU_DONATION_SUCCESS_URL,

      furl:
        PAYU_DONATION_FAILURE_URL,
    });

  await store.setPending(txnid, {
    type: "DONATION",

    ...donation,

    txnid,

    createdAt:
      Date.now(),
  });

  console.log("");
  console.log(
    "================================="
  );

  console.log(
    "💝 PAYU DONATION PAYMENT INITIATED"
  );

  console.log(
    "Transaction ID:",
    txnid
  );

  console.log(
    "Amount: ₹",
    donation.amount
  );

  console.log(
    "Success URL:",
    PAYU_DONATION_SUCCESS_URL
  );

  console.log(
    "Failure URL:",
    PAYU_DONATION_FAILURE_URL
  );

  console.log(
    "================================="
  );

  console.log("");

  return {
    paymentData,

    paymentUrl:
      PAYU_PAYMENT_URL,

    donation,
  };
}

// =========================================================
// PAYMENT SUCCESS
// =========================================================

// Browser callback and PayU webhook can arrive together; run them one at a time per txnid.
function processPaymentSuccess(data) {
  return store.withTxnLock(data && data.txnid, () => handlePaymentSuccess(data));
}

async function handlePaymentSuccess(data) {
  if (!data || !data.txnid) {
    throw new Error(
      "Transaction ID missing from PayU response."
    );
  }

  // -------------------------------------------------------
  // 1. VERIFY PAYU HASH FIRST
  // -------------------------------------------------------

  if (!verifyResponseHash(data)) {
    return {
      error:
        "Payment verification failed. Please contact the Trust.",

      status: 400,
    };
  }

  // -------------------------------------------------------
  // 2. VERIFY PAYMENT STATUS
  // -------------------------------------------------------

  if (
    String(data.status || "").toLowerCase() !== "success"
  ) {
    return {
      failure: true,
    };
  }

  // -------------------------------------------------------
  // 3. GET PENDING DONATION OR RECOVER IT
  // -------------------------------------------------------

  let pending =
    await store.getPending(data.txnid);

  /*
   * If pending data is missing, first check whether
   * the donation has already been saved.
   *
   * This can happen after a server restart or when
   * PayU sends the callback more than once.
   */

  if (!pending) {
    const existingDonation =
      await donationModel.findByTransactionId(
        data.txnid
      );

    if (existingDonation) {
      pending = {
        ...existingDonation,

        type: "DONATION",

        txnid: String(data.txnid),

        donorName: String(
          existingDonation.donorName || ""
        ).trim(),

        phoneNumber: String(
          existingDonation.phoneNumber || ""
        ).trim(),

        email: String(
          existingDonation.email || ""
        ).trim(),

        amount: Number(
          existingDonation.amount
        ),

        paymentMode: String(
          existingDonation.paymentMode || ""
        ).trim(),

        message: String(
          existingDonation.message || ""
        ).trim(),
      };
    } else {
      /*
       * The PayU hash has already been verified.
       *
       * Recover transaction details only when the
       * signed callback identifies this as a donation.
       */

      const isDonationCallback =
        String(data.udf1 || "").toUpperCase() ===
          "DONATION" &&
        String(data.productinfo || "").toLowerCase() ===
          "donation";

      if (!isDonationCallback) {
        return {
          error:
            "Donation transaction could not be verified.",

          status: 400,
        };
      }

      const callbackAmount =
        Number(data.amount);

      const callbackDonorName =
        String(data.firstname || "").trim();

      const callbackEmail =
        String(data.email || "").trim();

      const callbackPhone =
        String(
          data.phone || data.phoneNumber || ""
        ).trim();

      const callbackPaymentMode =
        String(data.udf2 || "").trim();

      const callbackMessage =
        String(data.udf3 || "").trim();

      if (
        !Number.isFinite(callbackAmount) ||
        callbackAmount < 100 ||
        !callbackDonorName ||
        !callbackPaymentMode ||
        callbackPaymentMode.toLowerCase() === "cash"
      ) {
        return {
          error:
            "Payment was received, but donation details could not be fully verified. Please contact the Trust with transaction ID: " +
            String(data.txnid),

          status: 400,
        };
      }

      pending = {
        type: "DONATION",

        donorName:
          callbackDonorName,

        phoneNumber:
          callbackPhone,

        email:
          callbackEmail,

        amount:
          callbackAmount,

        paymentMode:
          callbackPaymentMode,

        message:
          callbackMessage,

        cause:
          String(data.udf4 || "").trim() || GENERAL_CAUSE,

        purpose:
          String(data.udf5 || "").trim(),

        txnid:
          String(data.txnid),

        createdAt:
          Date.now(),
      };

      console.warn(
        "⚠️ Pending donation recovered from verified PayU callback:",
        String(data.txnid)
      );
    }
  }

  // -------------------------------------------------------
  // 4. VERIFY PAYMENT AMOUNT
  // -------------------------------------------------------

  if (
    !verifyPaymentAmount(
      data.amount,
      pending.amount
    )
  ) {
    return {
      error:
        "Payment amount verification failed.",

      status: 400,
    };
  }

  // -------------------------------------------------------
  // 5. VERIFY TRANSACTION ID
  // -------------------------------------------------------

  if (
    String(data.txnid) !==
    String(
      pending.txnid || pending.transactionId
    )
  ) {
    return {
      error:
        "Transaction verification failed.",

      status: 400,
    };
  }

  // -------------------------------------------------------
  // 6. VERIFY DONOR DETAILS
  // -------------------------------------------------------

  const donorName =
    String(
      pending.donorName ||
      data.firstname ||
      ""
    ).trim();

  if (!donorName) {
    return {
      error:
        "Payment was received, but donor information could not be verified. Please contact the Trust with transaction ID: " +
        String(data.txnid),

      status: 400,
    };
  }

  pending.donorName =
    donorName;

  // =======================================================
  // SAVE DONATION
  // =======================================================

  let savedDonation =
    await donationModel.findByTransactionId(
      data.txnid
    );

  const isNewDonation = !savedDonation;

  if (!savedDonation) {
    savedDonation =
      await donationModel.create({
        ...pending,

        transactionId:
          data.txnid,

        payuPaymentId:
          data.mihpayid || "",

        amount:
          Number(data.amount),

        paymentStatus:
          "SUCCESS",

        paymentDate:
          new Date().toISOString(),
      });
  } else {
    console.log(
      "ℹ️ Donation already exists. Duplicate save skipped."
    );
  }

  // =======================================================
  // PREPARE DONATION DATA
  // =======================================================

  const donation = {
    ...pending,

    donorName,

    transactionId:
      data.txnid,

    payuPaymentId:
      data.mihpayid || "",

    amount:
      Number(data.amount),

    paymentStatus:
      "SUCCESS",
  };

  // =======================================================
  // GENERATE DONATION CERTIFICATE
  // =======================================================

  let certificatePath =
    null;

  let certificateNumber =
    null;

  try {
    const certificate =
      await generateDonationCertificate(
        donation
      );

    certificatePath =
      certificate.path ||
      certificate.filePath;

    certificateNumber =
      certificate.certificateNumber ||
      certificate.number ||
      null;

    console.log("");

    console.log(
      "================================="
    );

    console.log(
      "📜 DONATION CERTIFICATE GENERATED"
    );

    console.log(
      "Transaction ID:",
      data.txnid
    );

    console.log(
      "Certificate:",
      certificatePath
    );

    console.log(
      "Certificate Number:",
      certificateNumber
    );

    console.log(
      "================================="
    );

    console.log("");

  } catch (error) {
    console.error(
      "❌ Donation certificate generation failed:",
      error.message
    );

    /*
     * Payment has already been verified and saved.
     * Certificate failure must not convert a successful
     * payment into a failed payment.
     */
  }

  // =======================================================
  // SEND EMAIL IN BACKGROUND
  // =======================================================

  /*
   * Do not await the email request here.
   *
   * The payment has already been verified and saved.
   * Sending the email in the background avoids making
   * the customer wait for the email server response.
   */

  let emailSent =
    false;

  // Email only once, even if PayU calls back again.
  if (
    isNewDonation &&
    certificatePath &&
    donation.email
  ) {
    emailSent = true;

    sendDonationCertificateEmail({
      donation,
      certificatePath,
    })
      .then(() => {
        console.log(
          "✅ Donation certificate email sent."
        );
      })
      .catch((error) => {
        console.error(
          "❌ Donation certificate email failed:",
          error.message
        );
      });
  }

  // =======================================================
  // DELETE PENDING DONATION
  // =======================================================

  await store.deletePending(
    data.txnid
  );

  // =======================================================
  // FINAL RESULT
  // =======================================================

  return {
    donation,

    transactionId:
      data.txnid,

    paymentId:
      data.mihpayid || "",

    paymentMode:
      pending.paymentMode,

    emailSent,

    certificatePath,

    certificateNumber,

    savedDonation,
  };
}

// =========================================================
// PAYMENT FAILURE
// =========================================================

async function processPaymentFailure(data) {
  const pending =
    data && data.txnid
      ? await store.getPending(data.txnid)
      : null;

  // Keep the persistent attempt record for safe retries and auditability.

  return {
    transactionId:
      data?.txnid ||
      "Not Available",

    errorMessage:
      data?.error_Message ||
      data?.error ||
      "Your donation payment could not be completed.",

    donation:
      pending || null,
  };
}

// =========================================================
// FIND A SAVED DONATION
// =========================================================

async function findDonation(transactionId) {
  const donation = await donationModel.findByTransactionId(transactionId);

  if (!donation || String(donation.paymentStatus || "").toUpperCase() !== "SUCCESS") {
    return null;
  }

  return donation;
}

// =========================================================
// CERTIFICATE FILE (made again if it is missing)
// =========================================================

async function getCertificatePath(transactionId) {
  const safeId = String(transactionId).replace(/[^A-Za-z0-9_-]/g, "_");
  const filePath = path.join(dataDir, "receipts", `donation-certificate-${safeId}.pdf`);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const donation = await findDonation(transactionId);

  if (!donation) {
    return null;
  }

  const certificate = await generateDonationCertificate({
    ...donation,
    txnid: donation.transactionId,
  });

  return certificate.path;
}

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  validateDonation,

  initiateDonation,

  processPaymentSuccess,

  processPaymentFailure,
  findDonation,
  getCertificatePath,
};