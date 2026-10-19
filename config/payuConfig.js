const PAYU_KEY = process.env.PAYU_KEY;
const PAYU_SALT = process.env.PAYU_SALT;

const PAYU_ENV = String(process.env.PAYU_ENV || "test").toLowerCase();

// "live" or "prod" would silently send live keys to the test gateway
if (!["test", "production"].includes(PAYU_ENV)) {
  throw new Error('PAYU_ENV must be "test" or "production"');
}

const PAYU_PAYMENT_URL =
  PAYU_ENV === "production"
    ? "https://secure.payu.in/_payment"
    : "https://test.payu.in/_payment";

// ============================================================
// MEMBERSHIP CALLBACK URLS
// ============================================================

const PAYU_SUCCESS_URL = process.env.PAYU_SUCCESS_URL;

const PAYU_FAILURE_URL = process.env.PAYU_FAILURE_URL;

// ============================================================
// DONATION CALLBACK URLS
// ============================================================

const PAYU_DONATION_SUCCESS_URL = process.env.PAYU_DONATION_SUCCESS_URL;

const PAYU_DONATION_FAILURE_URL = process.env.PAYU_DONATION_FAILURE_URL;

module.exports = {
  PAYU_KEY,
  PAYU_SALT,
  PAYU_ENV,
  PAYU_PAYMENT_URL,

  // Membership
  PAYU_SUCCESS_URL,
  PAYU_FAILURE_URL,

  // Donation
  PAYU_DONATION_SUCCESS_URL,
  PAYU_DONATION_FAILURE_URL,
};
