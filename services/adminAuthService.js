const bcrypt = require("bcrypt");

// ========================================
// ADMIN AUTHENTICATION SERVICE
// ========================================

/**
 * Verify admin password
 *
 * User enters password
 *        ↓
 * bcrypt.compare()
 *        ↓
 * ADMIN_PASSWORD_HASH
 */

// ========================================
// VERIFY ADMIN PASSWORD
// ========================================

async function verifyAdminPassword(password) {
  if (!password) {
    return false;
  }

  const storedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!storedHash) {
    throw new Error("ADMIN_PASSWORD_HASH is missing in .env");
  }

  return await bcrypt.compare(String(password), storedHash);
}

// ========================================
// VERIFY ADMIN LOGIN
// ========================================

async function authenticateAdmin({ password }) {
  const isValid = await verifyAdminPassword(password);

  if (!isValid) {
    return {
      success: false,
      message: "Invalid admin password",
    };
  }

  return {
    success: true,
    message: "Admin authentication successful",
  };
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  verifyAdminPassword,

  authenticateAdmin,
};
