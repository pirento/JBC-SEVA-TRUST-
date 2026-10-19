const fs = require("fs/promises");
const path = require("path");

const { dataDir } = require("../config/appConfig");

const { encrypt, decrypt } = require("../services/encryptionService");

// ========================================
// READ CACHE
// ========================================
//
// Decrypting a whole file on every request gets slow as records grow.
// Decrypted records are kept per file and reused until the file's size
// or modified time changes. Writes through this module clear the entry.
//
// shortcut: one Node process only; with several processes each keeps
// its own cache, which is still correct because it checks the file.
// ========================================

const cache = new Map();

function clearCache(fileName) {
  cache.delete(fileName);
}

// ========================================
// ENSURE DATA DIRECTORY
// ========================================

async function ensureDataDirectory() {
  await fs.mkdir(dataDir, {
    recursive: true,
  });
}

// ========================================
// GET FILE PATH
// ========================================

function getFilePath(fileName) {
  return path.join(dataDir, fileName);
}

// ========================================
// CHECK ENCRYPTED RECORD
// ========================================

function isEncryptedRecord(line) {
  try {
    const parsed = JSON.parse(line);

    return Boolean(
      parsed && typeof parsed === "object" && parsed.iv && parsed.authTag && parsed.data,
    );
  } catch {
    return false;
  }
}

// ========================================
// APPEND NEW ENCRYPTED RECORD
// ========================================

async function appendRecord(fileName, record) {
  await ensureDataDirectory();

  const filePath = getFilePath(fileName);

  // ----------------------------------------
  // Encrypt new record
  // ----------------------------------------

  const encryptedRecord = encrypt(record);

  // ----------------------------------------
  // Append encrypted JSON line
  // ----------------------------------------

  // Leading newline: if a crash cut off the last line, this record
  // still starts on its own line instead of being glued to it
  await fs.appendFile(filePath, "\n" + encryptedRecord + "\n", "utf8");

  clearCache(fileName);

  return {
    fileName,

    filePath,

    record,
  };
}

// ========================================
// READ + DECRYPT FILE
// ========================================

async function readRecords(fileName) {
  await ensureDataDirectory();

  const filePath = getFilePath(fileName);

  let stat;

  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const cached = cache.get(fileName);

  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
    // Copies, so callers can change a record without touching the cache
    return cached.records.map((record) => ({ ...record }));
  }

  const records = await readRecordsFromDisk(fileName, filePath);

  // Keyed by the size and time seen BEFORE reading: if a record is added
  // while we read, the entry no longer matches and the next read reloads.
  // (Keying by a stat taken after the read would keep the old records.)
  cache.set(fileName, { size: stat.size, mtimeMs: stat.mtimeMs, records });

  return records.map((record) => ({ ...record }));
}

async function readRecordsFromDisk(fileName, filePath) {
  let content;

  // ----------------------------------------
  // Read file
  // ----------------------------------------

  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  if (!content.trim()) {
    return [];
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // ========================================
  // DAMAGED LINES
  // ========================================
  // Usually a write cut off by a crash or a full disk. Skip it and keep
  // reading; never rewrite the file here, because a record appended
  // meanwhile would be lost.

  const bad = lines.filter((line) => !isEncryptedRecord(line)).length;
  if (bad > 0) console.error(`❌ ${fileName}: skipped ${bad} damaged line(s)`);

  // ========================================
  // NORMAL ENCRYPTED FILE
  // ========================================

  return lines.filter(isEncryptedRecord).map((line) => {
    try {
      return decrypt(line);
    } catch (error) {
      console.error("❌ Failed to decrypt record");

      console.error(error.message);

      throw new Error(
        "Encrypted data could not be decrypted. Check DATA_ENCRYPTION_KEY.",
      );
    }
  });
}

// ========================================
// EXPORT
// ========================================
// With MONGODB_URI set, records live in MongoDB (models/mongoStore.js)
// through the same two functions; otherwise in the encrypted files here.
// `files` is always the file store, for the migration script.

const files = { appendRecord, readRecords };

module.exports = process.env.MONGODB_URI
  ? { ...require("./mongoStore"), files }
  : { ...files, files };
