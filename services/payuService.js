const crypto = require("crypto");

const {
  PAYU_KEY,
  PAYU_SALT,
  PAYU_PAYMENT_URL,
  PAYU_ENV,
} = require("../config/payuConfig");

const PAYU_VERIFY_URL =
  PAYU_ENV === "production"
    ? "https://info.payu.in/merchant/postservice.php?form=2"
    : "https://test.payu.in/merchant/postservice.php?form=2";

// ============================================================
// SHA512
// ============================================================

function sha512(value) {
  return crypto.createHash("sha512").update(String(value), "utf8").digest("hex");
}

// ============================================================
// TRANSACTION ID
// ============================================================

function generateTxnId() {
  // Keep the existing TXN_ prefix for compatibility with saved records
  // and certificate URLs, while using a larger random suffix.
  return `TXN_${Date.now()}_${crypto.randomBytes(12).toString("hex")}`;
}

// ============================================================
// GENERATE PAYU HASH
// ============================================================

function generateHash({
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  udf1 = "",
  udf2 = "",
  udf3 = "",
  udf4 = "",
  udf5 = "",
}) {
  if (!PAYU_KEY) {
    throw new Error("PAYU_KEY is missing in .env");
  }

  if (!PAYU_SALT) {
    throw new Error("PAYU_SALT is missing in .env");
  }

  const hashString =
    `${PAYU_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|` +
    `${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${PAYU_SALT}`;

  return sha512(hashString);
}

// ============================================================
// CREATE PAYMENT DATA
// ============================================================

function createPaymentData({
  txnid,
  amount,
  firstname,
  email,
  phone,
  productinfo,

  udf1 = "",
  udf2 = "",
  udf3 = "",
  udf4 = "",
  udf5 = "",

  // Each flow passes its own callback URLs; no fallback, so a missing
  // donation URL can never send a donation to the membership handler
  surl,
  furl,
}) {
  if (!PAYU_KEY) {
    throw new Error("PAYU_KEY is missing in .env");
  }

  if (!PAYU_SALT) {
    throw new Error("PAYU_SALT is missing in .env");
  }

  if (!surl) {
    throw new Error("PayU success URL is missing in .env");
  }

  if (!furl) {
    throw new Error("PayU failure URL is missing in .env");
  }

  return {
    key: PAYU_KEY,

    txnid,
    amount,
    productinfo,

    firstname,
    email,
    phone,

    udf1,
    udf2,
    udf3,
    udf4,
    udf5,

    // PayU callback URLs
    surl,
    furl,

    // PayU hash
    hash: generateHash({
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
    }),
  };
}

// ============================================================
// VERIFY PAYU RESPONSE HASH
// ============================================================

function verifyResponseHash(data) {
  if (!PAYU_SALT) {
    throw new Error("PAYU_SALT is missing in .env");
  }

  if (!data) {
    return false;
  }

  const {
    status,
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1 = "",
    udf2 = "",
    udf3 = "",
    udf4 = "",
    udf5 = "",
    hash,
  } = data;

  if (
    !status ||
    !key ||
    !txnid ||
    !amount ||
    !productinfo ||
    !firstname ||
    !email ||
    !hash
  ) {
    return false;
  }

  // PayU prepends additionalCharges to the reverse hash when a convenience fee applies.
  const additionalCharges = data.additionalCharges ? `${data.additionalCharges}|` : "";

  const reverseHashString =
    `${additionalCharges}${PAYU_SALT}|${status}||||||` +
    `${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|` +
    `${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;

  return sha512(reverseHashString).toLowerCase() === String(hash).toLowerCase();
}

// ============================================================
// VERIFY PAYMENT AMOUNT
// ============================================================

function verifyPaymentAmount(receivedAmount, expectedAmount) {
  const received = Number(receivedAmount);
  const expected = Number(expectedAmount);

  return (
    Number.isFinite(received) &&
    Number.isFinite(expected) &&
    received.toFixed(2) === expected.toFixed(2)
  );
}

// ============================================================
// EXPORTS
// ============================================================

// ============================================================
// ASK PAYU ABOUT A TRANSACTION (verify_payment API)
// ============================================================
// For payments whose callback never reached the site. The answer comes
// straight from PayU over HTTPS, so it needs no response hash.

async function fetchPayUStatus(txnid) {
  const command = "verify_payment";
  const response = await fetch(PAYU_VERIFY_URL, {
    method: "POST",
    body: new URLSearchParams({
      key: PAYU_KEY,
      command,
      var1: txnid,
      hash: sha512(`${PAYU_KEY}|${command}|${txnid}|${PAYU_SALT}`),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`PayU answered ${response.status}`);

  const answer = await response.json();
  // status 0 means PayU refused the request itself (e.g. wrong key or salt)
  if (Number(answer?.status) !== 1 && !answer?.transaction_details) {
    throw new Error(`PayU: ${String(answer?.msg || "request refused").slice(0, 100)}`);
  }
  const details = answer.transaction_details?.[txnid];
  if (!details || typeof details !== "object") return { status: "not found" };

  return {
    ...details,
    status: String(details.status || "").toLowerCase(),
    amount: details.amt ?? details.transaction_amount ?? details.amount,
  };
}

// ============================================================
// PAYMENT MODE PAYU REPORTS
// ============================================================
// What the donor actually paid with on PayU's page, which can differ
// from the choice on our form. Unknown codes are ignored (the field is
// not covered by the response hash, so only known labels are used).

const PAYU_MODES = {
  CC: "Credit Card",
  DC: "Debit Card",
  NB: "Net Banking",
  UPI: "UPI",
  EMI: "EMI",
  CASH: "Wallet",
  WALLET: "Wallet",
  BNPL: "Pay Later",
};

function payuModeLabel(mode) {
  return PAYU_MODES[String(mode || "").toUpperCase()] || "";
}

module.exports = {
  fetchPayUStatus,
  payuModeLabel,
  generateTxnId,
  generateHash,
  createPaymentData,
  verifyResponseHash,
  verifyPaymentAmount,
  PAYU_PAYMENT_URL,
};
