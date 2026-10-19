const fs = require("fs");
const path = require("path");

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

const escapeHtml = require("../utils/escapeHtml");

const logoPath = path.join(__dirname, "..", "public", "images", "logo.jpeg");

// ============================================================
// MEMBERSHIP VALIDATION
// ============================================================

function validateMembership(input) {
  const memberName = String(input.memberName || "").trim();

  const cleanPhone = String(input.phoneNumber || "").trim();

  const cleanEmail = String(input.email || "").trim();

  const amount = Number(input.amount);

  const paymentMode = String(input.paymentMode || "").trim();

  const message = String(input.message || "").trim();

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

    membershipType,

    paymentMode,
    message,
  };
}

// ============================================================
// INITIATE MEMBERSHIP PAYMENT
// ============================================================

async function initiateMembership(input) {
  const membership = validateMembership(input);

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

    udf3: membership.message,

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

  console.log("Member:", membership.memberName);

  console.log("Membership Type:", membership.membershipType);

  console.log("Amount:", membership.amount);

  console.log("Email:", membership.email);

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

    paymentDate: new Date(),
  };

  // ----------------------------------------------------------
  // Generate Membership Certificate
  // ----------------------------------------------------------

  const pdfBuffer = await generateMembershipCertificate(receiptData);

  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("Membership certificate PDF generation failed.");
  }

  // ----------------------------------------------------------
  // Certificate filename
  // ----------------------------------------------------------

  const fileName = `membership-certificate-${data.txnid}.pdf`;

  store.setReceipt(data.txnid, {
    pdfBuffer,
    fileName,
    createdAt: Date.now(),
  });

  // Pending data no longer required.
  await store.deletePending(data.txnid);

  // ----------------------------------------------------------
  // Send email
  //
  // Existing email service is preserved.
  // ----------------------------------------------------------

  // Email only once, even if PayU calls back again.
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
  const memberName = String(membership.memberName || membership.donorName || "").trim();

  const fileName = `membership-certificate-${payuData.txnid}.pdf`;

  const attachments = [
    {
      filename: fileName,
      content: pdfBuffer,
      contentType: "application/pdf",
    },
  ];

  if (fs.existsSync(logoPath)) {
    attachments.push({
      filename: "jbc-seva-logo.jpeg",
      path: logoPath,
      cid: "jbc-seva-trust-logo",
    });
  }

  await sendEmail({
    to: membership.email,

    replyTo: membership.email,

    subject: "Membership Confirmation - JBC Seva Trust",

    text:
      `Dear ${memberName},\n\n` +
      `Thank you for becoming a member of JBC Seva Trust.\n\n` +
      `Your membership has been successfully processed.\n\n` +
      `Member Name: ${memberName}\n` +
      `Membership Amount: ₹${Number(membership.amount).toFixed(2)}\n` +
      `Membership Type: ${membership.membershipType}\n` +
      `Transaction ID: ${payuData.txnid}\n` +
      `Payment ID: ${payuData.mihpayid || "N/A"}\n\n` +
      `Your official membership certificate is attached to this email as a PDF.\n\n` +
      `Regards,\n` +
      `JBC Seva Trust`,

    html: createMembershipEmailHtml(
      {
        ...membership,
        memberName,
      },
      payuData,
    ),

    attachments,
  });
}

// ============================================================
// MEMBERSHIP EMAIL HTML
// ============================================================

function createMembershipEmailHtml(membership, payuData) {
  const memberName = String(membership.memberName || membership.donorName || "").trim();

  return `
<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width,initial-scale=1.0"
  >

  <title>Membership Confirmation</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f6f8;
    font-family:Arial,Helvetica,sans-serif;
  "
>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="background:#f4f6f8"
>

<tr>
<td align="center" style="padding:30px 15px">

<table
  width="600"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
    max-width:600px;
    width:100%;
    background:#ffffff;
    border-radius:10px;
    overflow:hidden;
  "
>

<!-- ======================================================
     HEADER
======================================================= -->

<tr>
<td
  align="center"
  style="
    padding:30px 20px;
    border-bottom:1px solid #eeeeee;
  "
>

<img
  src="cid:jbc-seva-trust-logo"
  alt="JBC Seva Trust"
  width="110"
  style="
    display:block;
    width:110px;
    max-width:110px;
    height:auto;
    margin:0 auto 15px;
  "
>

<h2
  style="
    margin:0 0 6px;
    font-size:22px;
    color:#222222;
  "
>
  JBC Seva Trust
</h2>

<p
  style="
    margin:0;
    font-size:14px;
    color:#777777;
  "
>
  Membership Confirmation
</p>

</td>
</tr>

<!-- ======================================================
     BODY
======================================================= -->

<tr>
<td
  style="
    padding:30px 25px;
    color:#333333;
    font-size:15px;
    line-height:1.6;
  "
>

<p>
  Dear
  <strong>
    ${escapeHtml(memberName)}
  </strong>,
</p>

<p>
  Thank you for becoming a member of
  <strong>
    JBC Seva Trust
  </strong>.
</p>

<p>
  Your membership has been successfully processed.
</p>

<table
  width="100%"
  cellpadding="10"
  cellspacing="0"
  border="0"
  style="
    border-collapse:collapse;
    margin-top:20px;
  "
>

<!-- MEMBER NAME -->

<tr>
<td
  style="
    border-bottom:1px solid #eeeeee;
    font-weight:bold;
  "
>
  Member Name
</td>

<td
  align="right"
  style="
    border-bottom:1px solid #eeeeee;
  "
>
  ${escapeHtml(memberName)}
</td>
</tr>

<!-- MEMBERSHIP AMOUNT -->

<tr>
<td
  style="
    border-bottom:1px solid #eeeeee;
    font-weight:bold;
  "
>
  Membership Amount
</td>

<td
  align="right"
  style="
    border-bottom:1px solid #eeeeee;
  "
>
  ₹${Number(membership.amount).toFixed(2)}
</td>
</tr>

<!-- MEMBERSHIP TYPE -->

<tr>
<td
  style="
    border-bottom:1px solid #eeeeee;
    font-weight:bold;
  "
>
  Membership Type
</td>

<td
  align="right"
  style="
    border-bottom:1px solid #eeeeee;
  "
>
  ${escapeHtml(membership.membershipType)}
</td>
</tr>

<!-- TRANSACTION ID -->

<tr>
<td
  style="
    border-bottom:1px solid #eeeeee;
    font-weight:bold;
  "
>
  Transaction ID
</td>

<td
  align="right"
  style="
    border-bottom:1px solid #eeeeee;
    word-break:break-all;
  "
>
  ${escapeHtml(payuData.txnid)}
</td>
</tr>

<!-- PAYMENT ID -->

<tr>
<td
  style="
    border-bottom:1px solid #eeeeee;
    font-weight:bold;
  "
>
  Payment ID
</td>

<td
  align="right"
  style="
    border-bottom:1px solid #eeeeee;
    word-break:break-all;
  "
>
  ${escapeHtml(payuData.mihpayid || "N/A")}
</td>
</tr>

<!-- PAYMENT MODE -->

<tr>
<td style="font-weight:bold">
  Payment Mode
</td>

<td align="right">
  ${escapeHtml(membership.paymentMode)}
</td>
</tr>

</table>

<!-- CERTIFICATE NOTICE -->

<div
  style="
    margin-top:25px;
    padding:15px;
    background:#f5f8fb;
    border-radius:7px;
  "
>

<p
  style="
    margin:0;
    font-size:14px;
    color:#444444;
  "
>
  📎 Your official membership certificate
  is attached to this email as a PDF.
</p>

</div>

<p style="margin-top:25px">
  Please keep this certificate for your records.
</p>

<p>
  Regards,<br>
  <strong>
    JBC Seva Trust
  </strong>
</p>

</td>
</tr>

<!-- ======================================================
     FOOTER
======================================================= -->

<tr>
<td
  align="center"
  style="
    padding:18px;
    background:#f4f4f4;
    font-size:12px;
    color:#777777;
  "
>
  This is an automated membership confirmation.
</td>
</tr>

</table>

</td>
</tr>

</table>

</body>
</html>
`;
}

// ============================================================
// EXPORTS
// ============================================================

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
