const bcrypt = require("bcrypt");

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

module.exports = { register, login, changePassword };
