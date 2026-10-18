const { appendRecord, readRecords } = require("./fileStore");

// ========================================
// DONATION DATA FILE
// ========================================

const FILE_NAME = "donations.txt";

// ========================================
// CREATE DONATION
// ========================================

async function create(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Donation data is required.");
  }

  const transactionId = String(
    data.transactionId || data.txnid || ""
  ).trim();

  const donorName = String(
    data.donorName || ""
  ).trim();

  const phoneNumber = String(
    data.phoneNumber || ""
  ).trim();

  const email = String(
    data.email || ""
  ).trim();

  const amount = Number(data.amount);

  const paymentMode = String(
    data.paymentMode || ""
  ).trim();

  if (!transactionId) {
    throw new Error("Transaction ID is required.");
  }

  if (!donorName) {
    throw new Error("Donor name is required.");
  }

  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error("Minimum donation amount is ₹100.");
  }

  if (!paymentMode || paymentMode === "Cash") {
    throw new Error(
      "Valid online payment mode is required."
    );
  }

  // ----------------------------------------
  // Prevent duplicate transaction
  // ----------------------------------------

  const existing =
    await findByTransactionId(transactionId);

  if (existing) {
    return existing;
  }

  // ----------------------------------------
  // Donation record
  // ----------------------------------------

  const record = {
    type: "DONATION",

    paymentStatus: "SUCCESS",

    transactionId,

    payuPaymentId: String(
      data.payuPaymentId ||
      data.mihpayid ||
      ""
    ).trim(),

    donorName,

    phoneNumber,

    email,

    amount,

    paymentMode,

    message: String(
      data.message || ""
    ).trim(),

    paymentDate:
      data.paymentDate ||
      new Date().toISOString(),
  };

  await appendRecord(
    FILE_NAME,
    record
  );

  console.log(
    "✅ Donation payment saved to donations.txt"
  );

  return record;
}

// ========================================
// GET ALL DONATIONS
// ========================================

async function findAll() {
  const records =
    await readRecords(FILE_NAME);

  return records.filter(
    (record) =>
      String(record.type || "")
        .toUpperCase() === "DONATION"
  );
}

// ========================================
// FIND BY TRANSACTION ID
// ========================================

async function findByTransactionId(
  transactionId
) {
  const id = String(
    transactionId || ""
  ).trim();

  if (!id) {
    return null;
  }

  const records =
    await readRecords(FILE_NAME);

  return (
    records.find(
      (record) =>
        String(
          record.transactionId || ""
        ) === id
    ) || null
  );
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  FILE_NAME,
  create,
  findAll,
  findByTransactionId,
};