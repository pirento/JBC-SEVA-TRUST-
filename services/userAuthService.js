const bcrypt = require("bcrypt");
const crypto = require("crypto");

const { sendEmail } = require("./emailService");
const { renderEmail } = require("./emailTemplate");
const { appUrl } = require("../config/appConfig");

const userModel = require("../models/userModel");
const { required, phone, email, accepted, personName } = require("../utils/validation");

const SALT_ROUNDS = 12;

// User-facing errors; anything else is a server fault
function invalid(message) {
  const error = new Error(message);
  error.expose = true;
  return error;
}
const MIN_PASSWORD = 8;

// Compared against when the email is unknown, so a wrong email
// takes as long as a wrong password and does not reveal accounts
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", SALT_ROUNDS);

function validatePassword(password, confirmPassword) {
  if (password.length < MIN_PASSWORD) {
    throw invalid(`Password must be at least ${MIN_PASSWORD} characters.`);
  }

  if (Buffer.byteLength(password) > 72) {
    // bcrypt ignores everything after 72 bytes
    throw invalid("Password is too long (maximum 72 characters).");
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw invalid("Password must contain at least one letter and one number.");
  }

  if (password !== confirmPassword) {
    throw invalid("Passwords do not match.");
  }
}

// Public view of a user, safe to keep in the session
function toSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    emailVerified: user.emailVerified === true,
    // Sessions from before a password change are logged out (app.js)
    passwordChangedAt: Number(user.passwordChangedAt) || 0,
    // Logged in with an emailed temporary password: must choose their own
    mustChangePassword: user.mustChangePassword === true,
  };
}

async function register(input) {
  const name = String(input.name || "").trim();
  const cleanEmail = userModel.normalizeEmail(input.email);
  const cleanPhone = String(input.phone || "").trim();
  const password = String(input.password || "");
  const confirmPassword = String(input.confirmPassword || "");

  if (!required(name)) throw invalid("Name is required.");
  if (name.length > 100) throw invalid("Name cannot exceed 100 characters.");
  if (!personName(name)) throw invalid("Please enter a valid name.");
  if (!email(cleanEmail)) throw invalid("Please enter a valid email address.");
  if (!phone(cleanPhone)) throw invalid("Please enter a valid 10 digit mobile number.");

  validatePassword(password, confirmPassword);

  if (!accepted(input.consent)) {
    throw invalid("Please accept the Terms and Privacy Policy.");
  }

  if (await userModel.findByEmail(cleanEmail)) {
    throw invalid("An account with this email already exists. Please log in.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await userModel.createUser({
    name,
    email: cleanEmail,
    phone: cleanPhone,
    passwordHash,
    lang: input.lang === "hi" ? "hi" : "en",
  });

  await requestEmailVerification(user.email);

  return toSessionUser(user);
}

async function login(input) {
  const password = String(input.password || "");
  const user = await userModel.findByEmail(input.email);

  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !valid) {
    throw invalid("Invalid email or password.");
  }

  if (user.mustChangePassword && Number(user.tempPasswordExpires) < Date.now()) {
    throw invalid(
      "This temporary password has expired. Use Forgot password to set a new one.",
    );
  }

  // The temporary password was sent to this email, so logging in with it
  // proves the address belongs to them
  if (user.mustChangePassword && !user.emailVerified) {
    return toSessionUser(await userModel.updateUser(user, { emailVerified: true }));
  }

  return toSessionUser(user);
}

// ============================================================
// ACCOUNT AFTER A PAYMENT
// ============================================================
// A donor or member does not need an account to pay. After the payment
// is verified, an account is made for their email (if there is none)
// and the login details go to that email. The password is temporary:
// it works for 7 days and must be replaced at the first login.

const TEMP_PASSWORD_DAYS = 7;
// No 0/O, 1/l/I, so it can be typed from a phone screen without mistakes
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function temporaryPassword() {
  const bytes = crypto.randomBytes(10);
  const letters = [...bytes].map((b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]);
  // Meets the password rule (a letter and a number)
  return `${letters.join("")}${(bytes[0] % 8) + 2}`;
}

// One account per email even if two payments for it arrive together
const creating = new Map();

async function ensureAccountForPayment({ name, email: rawEmail, phone: rawPhone, lang }) {
  const cleanEmail = userModel.normalizeEmail(rawEmail);
  if (!email(cleanEmail)) return null;
  if (creating.has(cleanEmail)) return creating.get(cleanEmail);

  const work = (async () => {
    if (await userModel.findByEmail(cleanEmail)) return null;
    return sendLoginDetails(
      await userModel.createUser({
        name: String(name || "").trim() || cleanEmail,
        email: cleanEmail,
        phone: String(rawPhone || "").trim(),
        // Unusable until sendLoginDetails sets the temporary password
        passwordHash: await bcrypt.hash(
          crypto.randomBytes(32).toString("hex"),
          SALT_ROUNDS,
        ),
        lang: lang === "hi" ? "hi" : "en",
      }),
    );
  })().finally(() => creating.delete(cleanEmail));

  creating.set(cleanEmail, work);
  return work;
}

// Gives the account a fresh temporary password and emails it. Used after
// a payment and by the admin ("send login details again"). Returns the
// password too, so tests can log in without an inbox.
async function sendLoginDetails(user) {
  const password = temporaryPassword();

  const updated = await userModel.updateUser(user, {
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    mustChangePassword: true,
    tempPasswordExpires: Date.now() + TEMP_PASSWORD_DAYS * 24 * 60 * 60 * 1000,
    passwordChangedAt: Date.now(),
  });

  const lang = user.lang === "hi" ? "hi" : "en";
  const { html, text } = renderEmail({
    lang,
    heading: "Your JBC Seva Trust account",
    greeting: lang === "hi" ? `नमस्ते ${user.name},` : `Namaste ${user.name},`,
    paragraphs: [
      "Thank you for your support. We have made an account for you, where you can see your donations and download your receipts.",
    ],
    rows: [
      ["Email", user.email],
      ["Temporary password", password],
    ],
    button: { label: "Log in", url: `${appUrl}/login` },
    note: "This password works for 7 days. When you log in, you will be asked to choose your own password.",
  });

  await sendEmail({
    to: user.email,
    subject:
      lang === "hi"
        ? "आपका खाता - JBC Seva Trust"
        : "Your account login details - JBC Seva Trust",
    text,
    html,
  }).catch((error) => console.error("❌ Login details email failed:", error.message));

  return { user: updated, password };
}

// First login with a temporary password: choose a password, no old one asked
async function setOwnPassword(sessionUser, input) {
  const user = await userModel.findByEmail(sessionUser.email);
  if (!user) throw invalid("Account not found.");

  const password = String(input.password || "");
  validatePassword(password, String(input.confirmPassword || ""));

  const updated = await userModel.updateUser(user, {
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    mustChangePassword: false,
    tempPasswordExpires: 0,
    passwordChangedAt: Date.now(),
  });

  return toSessionUser(updated);
}

async function changePassword(sessionUser, input) {
  const user = await userModel.findByEmail(sessionUser.email);

  if (!user) throw invalid("Account not found.");

  const currentPassword = String(input.currentPassword || "");
  const newPassword = String(input.newPassword || "");

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw invalid("Current password is incorrect.");
  }

  validatePassword(newPassword, String(input.confirmPassword || ""));

  const updated = await userModel.updateUser(user, {
    passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS),
    passwordChangedAt: Date.now(),
    mustChangePassword: false,
    tempPasswordExpires: 0,
  });

  return toSessionUser(updated);
}

// ============================================================
// EMAIL VERIFICATION
// ============================================================

const VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Sends a link that proves the email belongs to the account owner.
// Returns the token (or null) so tests can follow it without an inbox.
async function requestEmailVerification(email) {
  const user = await userModel.findByEmail(email);
  if (!user || user.emailVerified) return null;

  const token = crypto.randomBytes(32).toString("hex");

  await userModel.updateUser(user, {
    verifyTokenHash: hashToken(token),
    verifyExpires: Date.now() + VERIFY_TTL_MS,
  });

  const link = `${appUrl}/verify-email/${token}`;
  const lang = user.lang === "hi" ? "hi" : "en";

  const { html, text } = renderEmail({
    lang,
    heading: "Please confirm your email",
    greeting: lang === "hi" ? `नमस्ते ${user.name},` : `Namaste ${user.name},`,
    paragraphs: [
      "Thank you for creating an account. Please confirm that this email is yours. After that you can see your donations, memberships and receipts in My Account.",
    ],
    button: { label: "Confirm my email", url: link },
    note: "This link works for 7 days. If you did not create an account, you can ignore this email.",
  });

  sendEmail({
    to: user.email,
    subject:
      lang === "hi"
        ? "अपना ईमेल पक्का करें - JBC Seva Trust"
        : "Confirm your email - JBC Seva Trust",
    text,
    html,
  }).catch((error) => console.error("❌ Verification email failed:", error.message));

  return token;
}

async function verifyEmail(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ""))) return null;

  const hash = hashToken(token);
  const user = (await userModel.listUsers()).find(
    (u) => u.verifyTokenHash === hash && Number(u.verifyExpires) > Date.now(),
  );

  if (!user) return null;

  const updated = await userModel.updateUser(user, {
    emailVerified: true,
    verifyTokenHash: "",
    verifyExpires: 0,
  });

  return toSessionUser(updated);
}

async function isEmailVerified(email) {
  const user = await userModel.findByEmail(email);
  return Boolean(user && user.emailVerified);
}

// ============================================================
// FORGOT / RESET PASSWORD
// ============================================================

const RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Always behaves the same whether or not the email exists, so the
// form cannot be used to find out who has an account. Returns the
// token (or null) so tests can follow the link without an inbox.
async function requestPasswordReset(email) {
  const user = await userModel.findByEmail(email);
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("hex");

  await userModel.updateUser(user, {
    resetTokenHash: hashToken(token),
    resetExpires: Date.now() + RESET_TTL_MS,
  });

  const link = `${appUrl}/reset-password/${token}`;
  const lang = user.lang === "hi" ? "hi" : "en";

  const { html, text } = renderEmail({
    lang,
    heading: "Reset your password",
    greeting: lang === "hi" ? `नमस्ते ${user.name},` : `Namaste ${user.name},`,
    paragraphs: ["We received a request to set a new password for your account."],
    button: { label: "Set a new password", url: link },
    note: "This link works for one hour and only once. If you did not ask for this, ignore this email; your password stays the same.",
  });

  sendEmail({
    to: user.email,
    subject:
      lang === "hi"
        ? "पासवर्ड बदलें - JBC Seva Trust"
        : "Reset your password - JBC Seva Trust",
    text,
    html,
  }).catch((error) => console.error("❌ Reset email failed:", error.message));

  return token;
}

async function findByResetToken(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ""))) return null;

  const hash = hashToken(token);
  const users = await userModel.listUsers();

  return (
    users.find((u) => u.resetTokenHash === hash && Number(u.resetExpires) > Date.now()) ||
    null
  );
}

async function resetPassword(token, input) {
  const user = await findByResetToken(token);
  if (!user)
    throw invalid("This reset link is invalid or has expired. Please ask for a new one.");

  const password = String(input.password || "");
  validatePassword(password, String(input.confirmPassword || ""));

  await userModel.updateUser(user, {
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    resetTokenHash: "",
    resetExpires: 0,
    passwordChangedAt: Date.now(),
    mustChangePassword: false,
    tempPasswordExpires: 0,
    // Opening the emailed link proves the address
    emailVerified: true,
  });
}

module.exports = {
  register,
  login,
  ensureAccountForPayment,
  sendLoginDetails,
  setOwnPassword,
  changePassword,
  requestPasswordReset,
  findByResetToken,
  resetPassword,
  requestEmailVerification,
  verifyEmail,
  isEmailVerified,
};
