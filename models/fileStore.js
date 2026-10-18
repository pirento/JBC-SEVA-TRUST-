const fs = require("fs/promises");
const path = require("path");

const { dataDir } = require("../config/appConfig");

const { encrypt, decrypt } = require("../services/encryptionService");

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
      parsed &&
      typeof parsed === "object" &&
      parsed.iv &&
      parsed.authTag &&
      parsed.data,
    );
  } catch {
    return false;
  }
}

// ========================================
// PARSE OLD PLAINTEXT FILE
// ========================================

function parseLegacyContent(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  // ----------------------------------------
  // First line = old header
  // ----------------------------------------

  const headers = lines[0].split("\t");

  const records = [];

  // ----------------------------------------
  // Remaining lines = records
  // ----------------------------------------

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split("\t");

    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    records.push(record);
  }

  return records;
}

// ========================================
// CREATE BACKUP BEFORE MIGRATION
// ========================================

async function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const backupPath = `${filePath}.backup-${timestamp}`;

  await fs.copyFile(filePath, backupPath);

  console.log("📦 Legacy data backup created:", path.basename(backupPath));

  return backupPath;
}

// ========================================
// MIGRATE LEGACY DATA
// ========================================

async function migrateLegacyFile(filePath, content) {
  console.log("");
  console.log("=================================");

  console.log("🔄 Legacy data detected");

  console.log("📄 File:", path.basename(filePath));

  // ----------------------------------------
  // Parse old plaintext records
  // ----------------------------------------

  const records = parseLegacyContent(content);

  if (records.length === 0) {
    console.log("ℹ️ No legacy records found");

    console.log("=================================");

    return [];
  }

  // ----------------------------------------
  // Backup old file
  // ----------------------------------------

  await createBackup(filePath);

  // ----------------------------------------
  // Encrypt every record
  // ----------------------------------------

  const encryptedLines = records.map((record) => encrypt(record));

  // ----------------------------------------
  // Write encrypted file
  // ----------------------------------------

  await fs.writeFile(filePath, encryptedLines.join("\n") + "\n", "utf8");

  console.log(`✅ ${records.length} legacy record(s) migrated`);

  console.log("🔐 File is now encrypted");

  console.log("=================================");

  return records;
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

  await fs.appendFile(filePath, encryptedRecord + "\n", "utf8");

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
  // CHECK IF FILE IS LEGACY
  // ========================================

  const containsLegacyData = lines.some((line) => !isEncryptedRecord(line));

  if (containsLegacyData) {
    // ------------------------------------
    // Safety check
    // ------------------------------------

    const allLinesAreLegacy = lines.every((line) => !isEncryptedRecord(line));

    if (allLinesAreLegacy) {
      return await migrateLegacyFile(filePath, content);
    }

    // ------------------------------------
    // Mixed file
    // ------------------------------------
    // Some old + some new records.
    // Read both and rewrite everything
    // in encrypted format.
    // ------------------------------------

    console.log("");
    console.log("🔄 Mixed encrypted/legacy data detected");

    const records = [];

    for (const line of lines) {
      if (isEncryptedRecord(line)) {
        records.push(decrypt(line));
      } else {
        // --------------------------------
        // Legacy header is skipped
        // --------------------------------

        continue;
      }
    }

    // ------------------------------------
    // Find legacy header
    // ------------------------------------

    const legacyLines = lines.filter((line) => !isEncryptedRecord(line));

    if (legacyLines.length > 0) {
      const legacyContent = legacyLines.join("\n");

      const legacyRecords = parseLegacyContent(legacyContent);

      records.push(...legacyRecords);
    }

    // ------------------------------------
    // Backup
    // ------------------------------------

    await createBackup(filePath);

    // ------------------------------------
    // Encrypt everything again
    // ------------------------------------

    const encryptedLines = records.map((record) => encrypt(record));

    await fs.writeFile(filePath, encryptedLines.join("\n") + "\n", "utf8");

    console.log("✅ Mixed data migrated successfully");

    return records;
  }

  // ========================================
  // NORMAL ENCRYPTED FILE
  // ========================================

  return lines.map((line) => {
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
// READ FILE
// ========================================
//
// Kept for compatibility with existing code.
//
// Returns decrypted records as JSON string.
//
// ========================================

async function readFile(fileName) {
  const records = await readRecords(fileName);

  if (records.length === 0) {
    return "";
  }

  return JSON.stringify(records, null, 2);
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  appendRecord,

  readFile,

  readRecords,
};
