const {
  appendRecord,
  readRecords,
} = require("./fileStore");

const {
  required,
  phone,
  positiveAmount,
} = require("../utils/validation");

// ============================================================
// CREATE MEMBERSHIP PAYMENT RECORD
// ============================================================

async function create(data) {
  const memberName = String(
    data.memberName ||
    data.donorName ||
    ""
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

  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (!required(memberName)) {
    throw new Error(
      "Member name is required"
    );
  }

  if (!phone(phoneNumber)) {
    throw new Error(
      "Phone number must be 10 digits"
    );
  }

  if (!required(email)) {
    throw new Error(
      "Email is required"
    );
  }

  if (!positiveAmount(amount)) {
    throw new Error(
      "Membership amount must be greater than 0"
    );
  }

  if (amount < 100) {
    throw new Error(
      "Minimum membership amount is ₹100"
    );
  }

  if (!required(paymentMode)) {
    throw new Error(
      "Payment mode is required"
    );
  }

  if (paymentMode === "Cash") {
    throw new Error(
      "Cash payment is not available through online PayU payment"
    );
  }

  // ==========================================================
  // MEMBERSHIP TYPE
  // ==========================================================

  const membershipType =
    amount >= 11000
      ? "Lifetime Member"
      : "1 Year Member";

  // ==========================================================
  // SAVE MEMBERSHIP RECORD
  // ==========================================================

  return appendRecord(
    "payment.txt",
    {
      type: "MEMBERSHIP",

      paymentStatus: "SUCCESS",

      transactionId:
        String(
          data.txnid || ""
        ).trim(),

      payuPaymentId:
        String(
          data.mihpayid || ""
        ).trim(),

      // Single member
      memberName,

      // Backward compatibility
      donorName: memberName,

      membershipType,

      phoneNumber,

      email,

      amount,

      paymentMode,

      message:
        String(
          data.message || ""
        ).trim(),

      paymentDate:
        new Date().toISOString(),
    }
  );
}

// ============================================================
// FIND MEMBERSHIP BY TRANSACTION ID
// ============================================================

async function findByTransactionId(txnid) {
  const target =
    String(txnid || "").trim();

  if (!target) {
    return null;
  }

  // ==========================================================
  // CURRENT FILESTORE READER
  //
  // This automatically handles the current encrypted
  // payment.txt storage format.
  // ==========================================================

  const records =
    await readRecords("payment.txt");

  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  // ==========================================================
  // SEARCH TRANSACTION
  // ==========================================================

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const recordTxnId =
      record.transactionId ||
      record.txnid;

    if (
      String(
        recordTxnId || ""
      ).trim() !== target
    ) {
      continue;
    }

    return normalizeRecord({
      ...record,

      txnid: recordTxnId,

      mihpayid:
        record.payuPaymentId ||
        record.mihpayid ||
        "",

      paymentStatus:
        record.paymentStatus ||
        "SUCCESS",
    });
  }

  return null;
}

// ============================================================
// NORMALIZE MEMBERSHIP RECORD
// ============================================================

function normalizeRecord(record) {
  // ----------------------------------------------------------
  // SINGLE MEMBER NAME
  // ----------------------------------------------------------

  let memberName =
    String(
      record.memberName ||
      record.donorName ||
      ""
    ).trim();

  // ----------------------------------------------------------
  // OLD MEMBERNAMES[] COMPATIBILITY
  // ----------------------------------------------------------

  if (!memberName) {
    let oldMemberNames =
      record.memberNames;

    if (typeof oldMemberNames === "string") {
      try {
        const parsed =
          JSON.parse(oldMemberNames);

        if (Array.isArray(parsed)) {
          oldMemberNames = parsed;
        }
      } catch (_) {
        oldMemberNames =
          oldMemberNames
            .split("|")
            .map((name) => name.trim())
            .filter(Boolean);
      }
    }

    if (Array.isArray(oldMemberNames)) {
      memberName =
        String(
          oldMemberNames[0] || ""
        ).trim();
    }
  }

  // ----------------------------------------------------------
  // AMOUNT
  // ----------------------------------------------------------

  const amount =
    Number(record.amount) || 0;

  // ----------------------------------------------------------
  // MEMBERSHIP TYPE
  // ----------------------------------------------------------

  const membershipType =
    String(
      record.membershipType || ""
    ).trim() ||
    (
      amount >= 11000
        ? "Lifetime Member"
        : "1 Year Member"
    );

  // ----------------------------------------------------------
  // NORMALIZED RECORD
  // ----------------------------------------------------------

  return {
    ...record,

    type:
      record.type ||
      "MEMBERSHIP",

    memberName,

    donorName:
      record.donorName ||
      memberName,

    membershipType,

    amount,

    txnid:
      record.txnid ||
      record.transactionId,

    transactionId:
      record.transactionId ||
      record.txnid,

    mihpayid:
      record.mihpayid ||
      record.payuPaymentId ||
      "",

    payuPaymentId:
      record.payuPaymentId ||
      record.mihpayid ||
      "",

    paymentStatus:
      record.paymentStatus ||
      "SUCCESS",
  };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  create,
  findByTransactionId,
};