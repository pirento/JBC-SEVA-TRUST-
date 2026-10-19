const bcrypt = require("bcrypt");
const crypto = require("crypto");

const { sendEmail } = require("./emailService");
const { appUrl } = require("../config/appConfig");

const userModel = require("../models/userModel");
const { required, phone, email, accepted } = require("../utils/validation");

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
  });

  return toSessionUser(user);
}

async function login(input) {
  const password = String(input.password || "");
  const user = await userModel.findByEmail(input.email);

  const valid = await bcrypt.compare(
    password,
    user ? user.passwordHash : DUMMY_HASH,
  );

  if (!user || !valid) {
    throw invalid("Invalid email or password.");
  }

  return toSessionUser(user);
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

  await userModel.updateUser(user, {
    passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS),
  });
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

  sendEmail({
    to: user.email,
    subject: "Reset your password - JBC Seva Trust",
    text: `Namaste ${user.name},\n\nOpen this link within one hour to set a new password:\n${link}\n\nIf you did not ask for this, ignore this email.\n\nJBC Seva Trust`,
    html: `<p>Namaste ${user.name.replace(/[<>&"]/g, "")},</p><p>Open this link within one hour to set a new password:</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, ignore this email.</p><p>JBC Seva Trust</p>`,
  }).catch((error) => console.error("❌ Reset email failed:", error.message));

  return token;
}

async function findByResetToken(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ""))) return null;

  const hash = hashToken(token);
  const users = await userModel.listUsers();

  return (
    users.find((u) => u.resetTokenHash === hash && Number(u.resetExpires) > Date.now()) || null
  );
}

async function resetPassword(token, input) {
  const user = await findByResetToken(token);
  if (!user) throw invalid("This reset link is invalid or has expired. Please ask for a new one.");

  const password = String(input.password || "");
  validatePassword(password, String(input.confirmPassword || ""));

  await userModel.updateUser(user, {
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    resetTokenHash: "",
    resetExpires: 0,
  });
}

module.exports = {
  register,
  login,
  changePassword,
  requestPasswordReset,
  findByResetToken,
  resetPassword,
};
