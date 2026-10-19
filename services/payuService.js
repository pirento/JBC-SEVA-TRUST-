const crypto = require("crypto");

const {
  PAYU_KEY,
  PAYU_SALT,
  PAYU_SUCCESS_URL,
  PAYU_FAILURE_URL,
  PAYU_PAYMENT_URL,
} = require("../config/payuConfig");

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

  // Optional callback URLs
  // Membership will continue using the existing URLs.
  // Donation can pass its own URLs.
  surl = PAYU_SUCCESS_URL,
  furl = PAYU_FAILURE_URL,
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
// VERIFY PAYU KEY
// ============================================================

function verifyPayUKey(key) {
  return !!PAYU_KEY && !!key && String(key) === String(PAYU_KEY);
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

module.exports = {
  generateTxnId,
  generateHash,
  createPaymentData,
  verifyResponseHash,
  verifyPayUKey,
  verifyPaymentAmount,
  PAYU_PAYMENT_URL,
};
