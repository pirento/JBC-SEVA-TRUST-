const crypto = require("crypto");

const { appendRecord, readRecords } = require("./fileStore");

const FILE_NAME = "accounts.txt";

// ============================================================
// USER ACCOUNTS
// ============================================================
//
// The file store is append-only, so an update (e.g. password
// change) appends a new version and the latest one wins.
//
// shortcut: reads the whole file on every lookup, move to a real
// database once accounts reach the thousands.
// ============================================================

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function listUsers() {
  const records = await readRecords(FILE_NAME);
  const latest = new Map();

  for (const record of records) {
    if (record.type === "USER" && record.email) {
      latest.set(record.email, record);
    }
  }

  return [...latest.values()];
}

async function findByEmail(value) {
  const email = normalizeEmail(value);
  const users = await listUsers();
  return users.find((user) => user.email === email) || null;
}

async function createUser({ name, email, phone, passwordHash, lang = "en" }) {
  const now = new Date().toISOString();

  const user = {
    type: "USER",
    id: crypto.randomUUID(),
    name,
    email: normalizeEmail(email),
    phone,
    passwordHash,
    lang,
    // Records are matched by email, so they stay hidden until the
    // owner proves the address is theirs
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  };

  await appendRecord(FILE_NAME, user);
  return user;
}

async function updateUser(user, changes) {
  const updated = {
    ...user,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  await appendRecord(FILE_NAME, updated);
  return updated;
}

module.exports = {
  normalizeEmail,
  listUsers,
  findByEmail,
  createUser,
  updateUser,
};
