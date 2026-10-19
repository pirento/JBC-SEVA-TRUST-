const crypto = require("crypto");

// ========================================
// CONFIGURATION
// ========================================

const ALGORITHM = "aes-256-gcm";

const KEY_HEX = process.env.DATA_ENCRYPTION_KEY;

if (!KEY_HEX) {
  throw new Error("DATA_ENCRYPTION_KEY is missing in .env");
}

// 32 bytes = 256 bits
const KEY = Buffer.from(KEY_HEX, "hex");

if (KEY.length !== 32) {
  throw new Error("DATA_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)");
}

// ========================================
// ENCRYPT DATA
// ========================================

function encrypt(data) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const jsonData = typeof data === "string" ? data : JSON.stringify(data);

  let encrypted = cipher.update(jsonData, "utf8", "base64");

  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),

    authTag: authTag.toString("base64"),

    data: encrypted,
  });
}

// ========================================
// DECRYPT DATA
// ========================================

function decrypt(encryptedData) {
  const payload =
    typeof encryptedData === "string" ? JSON.parse(encryptedData) : encryptedData;

  const iv = Buffer.from(payload.iv, "base64");

  const authTag = Buffer.from(payload.authTag, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.data, "base64", "utf8");

  decrypted += decipher.final("utf8");

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  encrypt,

  decrypt,
};
