const userAuthService = require("./userAuthService");
const Membership = require("../models/membershipModel");

const {
  generateTxnId,
  createPaymentData,
  verifyResponseHash,
  verifyPaymentAmount,
  PAYU_PAYMENT_URL,
} = require("./payuService");

// ============================================================
// MEMBERSHIP PAYU CALLBACK URLS
// ============================================================

const { PAYU_SUCCESS_URL, PAYU_FAILURE_URL } = require("../config/payuConfig");

const { generateMembershipCertificate } = require("./membershipCertificateService");

const { sendEmail } = require("./emailService");

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

const { renderEmail, t } = require("./emailTemplate");
const { appUrl } = require("../config/appConfig");

// ============================================================
// MEMBERSHIP VALIDATION
// ============================================================

function validateMembership(input) {
  const memberName = String(input.memberName || "").trim();

  const cleanPhone = String(input.phoneNumber || "").trim();

  const cleanEmail = String(input.email || "").trim();

  const amount = Number(input.amount);

  const paymentMode = String(input.paymentMode || "").trim();

  const message = String(input.message || "")
    .trim()
    .slice(0, 500);

  // ----------------------------------------------------------
  // Member Name
  // ----------------------------------------------------------

  if (!required(memberName)) {
    throw new Error("Member name is required.");
  }

  if (memberName.length > 100) {
    throw new Error("Member name cannot exceed 100 characters.");
  }

  if (!personName(memberName)) {
    throw new Error("Please enter a valid name.");
  }

  if (!fewLinks(input.message, 0)) {
    throw new Error("Links are not allowed in the message.");
  }

  // ----------------------------------------------------------
  // Phone
  // ----------------------------------------------------------

  if (!phone(cleanPhone)) {
    throw new Error("Phone number must be 10 digits");
  }

  // ----------------------------------------------------------
  // Email
  // ----------------------------------------------------------

  if (!required(cleanEmail)) {
    throw new Error("Email is required");
  }

  if (!email(cleanEmail)) {
    throw new Error("Please enter a valid email address");
  }

  // ----------------------------------------------------------
  // Membership Amount
  //
  // Minimum = ₹100
  //
  // ₹100 - ₹10,999 = 1 Year Member
  // ₹11,000+       = Lifetime Member
  // ----------------------------------------------------------

  if (!positiveAmount(amount)) {
    throw new Error("Membership amount must be greater than 0");
  }

  if (amount < 100) {
    throw new Error("Minimum membership amount is ₹100.");
  }

  // Catches typing mistakes (an extra zero); large gifts go through the trust directly
  if (amount > 1000000) {
    throw new Error("For amounts above ₹10,00,000 please contact the Trust directly.");
  }

  // ----------------------------------------------------------
  // Payment Mode
  // ----------------------------------------------------------

  if (!required(paymentMode)) {
    throw new Error("Payment mode is required");
  }

  if (paymentMode === "Cash") {
    throw new Error("Cash payment is not available through online PayU payment");
  }

  if (!accepted(input.consent)) {
    throw new Error("Please accept the Terms, Privacy Policy and Refund Policy");
  }

  // ----------------------------------------------------------
  // Membership Type
  // ----------------------------------------------------------

  const membershipType = amount >= 11000 ? "Lifetime Member" : "1 Year Member";

  // ----------------------------------------------------------
  // Return normalized membership data
  // ----------------------------------------------------------

  return {
    // Keep donorName for compatibility
    // with existing PayU/model/email code.
    donorName: memberName,

    // New single-member field
    memberName,

    phoneNumber: cleanPhone,
    email: cleanEmail,
    amount,

    // Language of the emails sent to this member
    lang: input.lang === "hi" ? "hi" : "en",

    membershipType,

    paymentMode,
    message,
  };
}

// ============================================================
// INITIATE MEMBERSHIP PAYMENT
// ============================================================

async function initiateMembership(input) {
  let membership;
  try {
    membership = validateMembership(input);
  } catch (error) {
    // A validation message is for the member; other errors are not shown
    error.expose = true;
    throw error;
  }

  const txnid = generateTxnId();

  const paymentData = createPaymentData({
    txnid,

    amount: membership.amount.toFixed(2),

    // PayU firstname
    firstname: membership.memberName,

    email: membership.email,

    phone: membership.phoneNumber,

    productinfo: "Membership",

    // --------------------------------------------------------
    // UDF FIELDS
    // --------------------------------------------------------
    // UDF1 = Membership Type
    // UDF2 = Payment Mode
    // UDF3 = Message
    // UDF4/UDF5 = Empty
    // --------------------------------------------------------

    udf1: membership.membershipType,

    udf2: membership.paymentMode,

    // Message stays in the pending store; PayU limits udf fields to 255 characters
    udf3: "",

    udf4: "",

    udf5: "",

    // --------------------------------------------------------
    // MEMBERSHIP PAYU CALLBACK URLS
    // --------------------------------------------------------

    surl: PAYU_SUCCESS_URL,

    furl: PAYU_FAILURE_URL,
  });

  // ----------------------------------------------------------
  // Store pending membership
  // ----------------------------------------------------------

  await store.setPending(txnid, {
    ...membership,

    txnid,

    createdAt: Date.now(),
  });

  store.cleanup();

  // ----------------------------------------------------------
  // Console
  // ----------------------------------------------------------

  console.log("\n=================================");

  console.log("💳 PAYU MEMBERSHIP PAYMENT INITIATED");

  console.log("Transaction:", txnid);

  console.log("Membership Type:", membership.membershipType);

  console.log("Amount:", membership.amount);

  console.log("Success URL:", PAYU_SUCCESS_URL);

  console.log("Failure URL:", PAYU_FAILURE_URL);

  console.log("=================================");

  return {
    paymentData,

    paymentUrl: PAYU_PAYMENT_URL,

    // Keep existing property name
    // so current PayU EJS does not break.
    donation: membership,
  };
}

// ============================================================
// PAYMENT SUCCESS
// ============================================================

// Browser callback and PayU webhook can arrive together; run them one at a time per txnid.
function processPaymentSuccess(data) {
  return store.withTxnLock(data && data.txnid, () => handlePaymentSuccess(data));
}

async function handlePaymentSuccess(data) {
  if (!data || !data.txnid) {
    throw new Error("Transaction ID missing from PayU response.");
  }

  // ----------------------------------------------------------
  // Verify PayU response hash
  // ----------------------------------------------------------

  if (!verifyResponseHash(data)) {
    return {
      error: "Payment verification failed. Please contact the Trust.",
      status: 400,
    };
  }

  // ----------------------------------------------------------
  // Check PayU status
  // ----------------------------------------------------------

  if (String(data.status || "").toLowerCase() !== "success") {
    return {
      failure: true,
    };
  }

  // A donation posted here must not be saved as a membership
  if (String(data.productinfo || "").toLowerCase() !== "membership") {
    return { error: "Transaction could not be verified.", status: 400 };
  }

  // ----------------------------------------------------------
  // Get pending membership
  // ----------------------------------------------------------

  let pending = await store.getPending(data.txnid);

  if (!pending) {
    pending = await Membership.findByTransactionId(data.txnid);
  }

  if (!pending) {
    return {
      error: "Transaction could not be verified.",
      status: 400,
    };
  }

  // ----------------------------------------------------------
  // Verify amount
  // ----------------------------------------------------------

  if (!verifyPaymentAmount(data.amount, pending.amount)) {
    return {
      error: "Payment amount verification failed.",
      status: 400,
    };
  }

  // ----------------------------------------------------------
  // Verify transaction
  // ----------------------------------------------------------

  if (String(data.txnid) !== String(pending.txnid)) {
    return {
      error: "Transaction verification failed.",
      status: 400,
    };
  }

  // ----------------------------------------------------------
  // Recalculate membership type from VERIFIED amount
  //
  // This ensures certificate type is based on
  // the actual verified PayU amount.
  // ----------------------------------------------------------

  const verifiedAmount = Number(data.amount);

  const membershipType = verifiedAmount >= 11000 ? "Lifetime Member" : "1 Year Member";

  pending.membershipType = membershipType;

  // ----------------------------------------------------------
  // Ensure single member name exists
  // ----------------------------------------------------------

  const memberName = String(
    pending.memberName || pending.donorName || data.firstname || "",
  ).trim();

  if (!memberName) {
    return {
      error: "Member information could not be verified.",
      status: 400,
    };
  }

  pending.memberName = memberName;

  // Keep compatibility with existing
  // email/model code.
  pending.donorName = memberName;

  // ----------------------------------------------------------
  // Save payment
  // ----------------------------------------------------------

  let savedPayment = await Membership.findByTransactionId(data.txnid);

  const isNewPayment = !savedPayment;

  if (!savedPayment) {
    savedPayment = await Membership.create({
      ...pending,

      txnid: data.txnid,

      mihpayid: data.mihpayid || "",

      paymentStatus: "SUCCESS",

      paymentDate: new Date(),
    });

    console.log("✅ Membership payment saved to payment.txt");
  } else {
    console.log("ℹ️ Payment already exists. Duplicate save skipped.");
  }

  // ----------------------------------------------------------
  // Certificate data
  // ----------------------------------------------------------

  const receiptData = {
    ...pending,

    memberName: memberName,

    donorName: memberName,

    txnid: data.txnid,

    mihpayid: data.mihpayid || "",

    amount: verifiedAmount,

    membershipType,

    // A repeated callback keeps the original payment time (and Valid Till)
    paymentDate: savedPayment.paymentDate || new Date(),
  };

  // ----------------------------------------------------------
  // Generate Membership Certificate
  // ----------------------------------------------------------

  // The payment is already saved: a certificate failure must not show
  // the member an error page. The download link makes it again later.
  let pdfBuffer = null;

  try {
    pdfBuffer = await generateMembershipCertificate(receiptData);
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) pdfBuffer = null;
  } catch (error) {
    console.error("❌ Membership certificate generation failed:", error.message);
  }

  if (pdfBuffer) {
    store.setReceipt(data.txnid, {
      pdfBuffer,
      fileName: `membership-certificate-${data.txnid}.pdf`,
      createdAt: Date.now(),
    });
  }

  // Pending data no longer required.
  await store.deletePending(data.txnid);

  // ----------------------------------------------------------
  // Send email
  //
  // Existing email service is preserved.
  // ----------------------------------------------------------

  // Email only once, even if PayU calls back again.
  // No account needed to join; one is made afterwards for this email
  if (isNewPayment)
    userAuthService
      .ensureAccountForPayment({
        name: memberName,
        email: pending.email,
        phone: pending.phoneNumber,
        lang: pending.lang,
      })
      .catch((error) => console.error("❌ Member account failed:", error.message));

  if (isNewPayment)
    sendMembershipEmail(
      {
        ...pending,
        memberName,
        donorName: memberName,
        membershipType,
        amount: verifiedAmount,
      },
      data,
      pdfBuffer,
    ).catch((err) => {
      console.error("⚠️ Membership email failed:", err.message);
    });

  // ----------------------------------------------------------
  // Response
  // ----------------------------------------------------------

  return {
    // Keep old property name for compatibility
    // with existing success page.
    donation: {
      ...pending,

      memberName,
      donorName: memberName,

      membershipType,
      amount: verifiedAmount,
    },

    transactionId: data.txnid,

    paymentId: data.mihpayid || "",

    membershipType,

    receiptUrl: `/donation/receipt/${encodeURIComponent(data.txnid)}`,

    savedPayment,

    emailSent: true,
  };
}

// ============================================================
// PAYMENT FAILURE
// ============================================================

async function processPaymentFailure(data) {
  const pending = data && data.txnid ? await store.getPending(data.txnid) : null;

  // Do not erase pending state here: failure callbacks may be retried,
  // and this route must not let an unverified request destroy the record.

  return {
    transactionId: data?.txnid || "Not Available",

    errorMessage:
      data?.error_Message || data?.error || "Your payment could not be completed.",

    // Keep existing property name
    // for current failure EJS.
    donation: pending || null,
  };
}

// ============================================================
// GET MEMBERSHIP CERTIFICATE
// ============================================================

async function getReceipt(transactionId) {
  store.cleanup();

  let receipt = store.getReceipt(transactionId);

  if (receipt) {
    return receipt;
  }

  const payment = await Membership.findByTransactionId(transactionId);

  if (!payment) {
    throw Object.assign(
      new Error("Membership certificate not found for this transaction."),
      { status: 404 },
    );
  }

  if (String(payment.paymentStatus || "").toUpperCase() !== "SUCCESS") {
    throw Object.assign(
      new Error("Membership certificate is not available for this payment."),
      { status: 404 },
    );
  }

  // ----------------------------------------------------------
  // Single member
  //
  // New records use memberName.
  // donorName is retained as legacy fallback.
  // ----------------------------------------------------------

  const memberName = String(payment.memberName || payment.donorName || "").trim();

  if (!memberName) {
    throw Object.assign(new Error("Member name is missing from this payment."), {
      status: 400,
    });
  }

  const amount = Number(payment.amount);

  // Always derive membership type from amount
  // if it is missing from the saved record.
  const membershipType =
    payment.membershipType || (amount >= 11000 ? "Lifetime Member" : "1 Year Member");

  const pdfBuffer = await generateMembershipCertificate({
    memberName,

    // Legacy compatibility
    donorName: memberName,

    phoneNumber: payment.phoneNumber,

    email: payment.email,

    amount,

    membershipType,

    paymentMode: payment.paymentMode,

    message: payment.message || "",

    txnid: payment.txnid || payment.transactionId,

    mihpayid: payment.mihpayid || payment.payuPaymentId || "",

    paymentDate: payment.paymentDate || new Date(),
  });

  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("Generated membership certificate PDF is invalid.");
  }

  receipt = {
    pdfBuffer,

    fileName: `membership-certificate-${transactionId}.pdf`,

    createdAt: Date.now(),
  };

  store.setReceipt(transactionId, receipt);

  return receipt;
}

// ============================================================
// MEMBERSHIP EMAIL
// ============================================================

async function sendMembershipEmail(membership, payuData, pdfBuffer) {
  const lang = membership.lang === "hi" ? "hi" : "en";
  const memberName = String(membership.memberName || membership.donorName || "").trim();
  const amount = Number(membership.amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const { html, text } = renderEmail({
    lang,
    preheader: `Your ${membership.membershipType} membership is confirmed`,
    heading: "Welcome to JBC Seva Trust",
    greeting: lang === "hi" ? `नमस्ते ${memberName},` : `Dear ${memberName},`,
    paragraphs: [
      pdfBuffer
        ? "Thank you for becoming a member. Your membership certificate is attached to this email as a PDF."
        : "Thank you for becoming a member. You can download your membership certificate with the button below.",
    ],
    rows: [
      ["Membership", t(membership.membershipType, lang)],
      ["Amount", `₹${amount}`],
      ["Payment mode", membership.paymentMode],
      ["Transaction ID", payuData.txnid],
    ],
    button: {
      label: "Download Membership Certificate",
      url: `${appUrl}/donation/receipt/${encodeURIComponent(payuData.txnid)}`,
    },
    note: "Membership does not give ownership, voting or management rights in the Trust.",
  });

  await sendEmail({
    to: membership.email,
    // Receipt: the trust keeps a hidden copy
    copyTrust: true,
    subject:
      lang === "hi"
        ? "सदस्यता की पुष्टि - JBC Seva Trust"
        : "Membership confirmed - JBC Seva Trust",
    text,
    html,
    // Without a PDF the email still goes, with the download button
    attachments: pdfBuffer
      ? [
          {
            filename: `membership-certificate-${payuData.txnid}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [],
  });
}

// ============================================================
// FIND A SAVED MEMBERSHIP
// ============================================================

async function findMembership(transactionId) {
  const membership = await Membership.findByTransactionId(transactionId);

  if (!membership || String(membership.paymentStatus || "").toUpperCase() !== "SUCCESS") {
    return null;
  }

  return membership;
}

module.exports = {
  findMembership,
  validateMembership,
  initiateMembership,
  processPaymentSuccess,
  processPaymentFailure,
  getReceipt,
  sendMembershipEmail,
};
