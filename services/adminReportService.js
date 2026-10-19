const { readCorrected } = require("../models/records");
const { donationPages } = require("../config/trustConfig");

// Temple gifts go to a separate fund head and are reported on their own
const TEMPLE_CAUSES = new Set(
  donationPages.filter((p) => p.donation.religious).map((p) => p.title),
);

// ========================================
// GET RECORD DATE
// ========================================

function getRecordDate(record) {
  const dateValue = record.paymentDate || record.submittedAt || record.createdAt || null;

  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// ========================================
// FORMAT DATE
// ========================================

// Formatters are built once; creating one per call is slow on large lists
const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

function formatDate(date) {
  return DATE_FORMAT.format(date);
}

// ========================================
// FORMAT TIME
// ========================================

function formatTime(date) {
  return TIME_FORMAT.format(date);
}

// ========================================
// CHECK SELECTED DATE
// ========================================

function isSameDate(record, selectedDate) {
  const date = getRecordDate(record);

  if (!date) {
    return false;
  }

  return indiaDate(date) === selectedDate;
}

// YYYY-MM-DD in India time, whatever the server's own time zone is
function indiaDate(date) {
  return DAY_FORMAT.format(date);
}

// ========================================
// NORMALIZE MEMBERSHIP
// ========================================

function normalizeMembership(record) {
  const date = getRecordDate(record);

  const memberName = String(record.memberName || record.donorName || "").trim();

  const amount = Number(record.amount) || 0;

  const membershipType =
    String(record.membershipType || "").trim() ||
    (amount >= 11000 ? "Lifetime Member" : "1 Year Member");

  return {
    memberName,
    membershipType,
    amount,
    paymentMode: String(record.paymentMode || "Online").trim(),
    paymentStatus: String(record.paymentStatus || "SUCCESS").trim(),
    transactionId: String(record.transactionId || record.txnid || "").trim(),
    payuPaymentId: String(record.payuPaymentId || record.mihpayid || "").trim(),
    phoneNumber: String(record.phoneNumber || "").trim(),
    email: String(record.email || "").trim(),
    date: date ? formatDate(date) : "-",
    time: date ? formatTime(date) : "-",
  };
}

// ========================================
// NORMALIZE DONATION
// ========================================

function normalizeDonation(record) {
  const date = getRecordDate(record);

  return {
    donorName: String(record.donorName || "").trim(),

    phoneNumber: String(record.phoneNumber || "").trim(),

    email: String(record.email || "").trim(),

    amount: Number(record.amount) || 0,

    paymentMode: String(record.paymentMode || "Online").trim(),

    paymentStatus: String(record.paymentStatus || "SUCCESS").trim(),

    transactionId: String(record.transactionId || record.txnid || "").trim(),

    payuPaymentId: String(record.payuPaymentId || record.mihpayid || "").trim(),

    message: String(record.message || "").trim(),

    cause: String(record.cause || "").trim(),

    purpose: String(record.purpose || "").trim(),

    dedication: record.dedicatedTo
      ? `${record.dedicationType} ${record.dedicatedTo}`.trim()
      : "",

    sevaDate: String(record.sevaDate || "").trim(),

    date: date ? formatDate(date) : "-",
    time: date ? formatTime(date) : "-",
  };
}

// ========================================
// NORMALIZE MEDICAL
// ========================================

function normalizeMedical(record) {
  const date = getRecordDate(record);

  return {
    patientName: String(record.patientName || "").trim(),

    aadharNumber: String(record.aadharNumber || "").trim(),

    dateBirth: String(record.dateBirth || "").trim(),

    patientReferenceName: String(record.patientReferenceName || "").trim(),

    patientPhoneNumber: String(record.patientPhoneNumber || "").trim(),

    patientEmail: String(record.patientEmail || "").trim(),

    receiptFile: String(record.receiptFile || ""),

    nameDiseases: String(record.nameDiseases || "").trim(),

    hospitalName: String(record.hospitalName || "").trim(),

    referenceRegistrationNumber: String(record.referenceRegistrationNumber || "").trim(),

    date: date ? formatDate(date) : "-",
    time: date ? formatTime(date) : "-",
  };
}

// ========================================
// GET DAILY REPORT DATA
// ========================================

async function getDailyReport(selectedDate) {
  if (!selectedDate) {
    throw new Error("Report date is required");
  }

  // ========================================
  // READ ALL DATA
  // ========================================

  const paymentRecords = await readCorrected("payment.txt");

  const donationRecords = await readCorrected("donations.txt");

  const medicalRecordsRaw = await readCorrected("user.txt");

  // ========================================
  // MEMBERSHIPS
  // ========================================

  const memberships = paymentRecords
    .filter((record) => {
      const status = String(record.paymentStatus || "SUCCESS").toUpperCase();

      return status === "SUCCESS" && isSameDate(record, selectedDate);
    })
    .map(normalizeMembership);

  // ========================================
  // DONATIONS
  // ========================================

  const donations = donationRecords
    .filter((record) => {
      const status = String(record.paymentStatus || "SUCCESS").toUpperCase();

      return status === "SUCCESS" && isSameDate(record, selectedDate);
    })
    .map(normalizeDonation);

  // ========================================
  // MEDICAL HELP
  // ========================================

  const medicalRecords = medicalRecordsRaw
    .filter((record) => {
      const type = String(record?.type || "").toUpperCase();

      return type === "MEDICAL_HELP" && isSameDate(record, selectedDate);
    })
    .map(normalizeMedical);

  // ========================================
  // CALCULATIONS
  // ========================================

  const membershipCollection = memberships.reduce(
    (total, item) => total + Number(item.amount || 0),
    0,
  );

  const donationCollection = donations.reduce(
    (total, item) => total + Number(item.amount || 0),
    0,
  );

  const totalCollection = membershipCollection + donationCollection;

  const templeCollection = donations
    .filter((item) => TEMPLE_CAUSES.has(item.cause))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  // ========================================
  // REPORT SUMMARY
  // ========================================

  return {
    reportDate: selectedDate,

    generatedAt: new Date().toISOString(),

    summary: {
      membershipCount: memberships.length,

      membershipCollection,

      donationCount: donations.length,

      donationCollection,

      templeCollection,

      medicalCount: medicalRecords.length,

      totalCollection,
    },

    memberships,

    donations,

    medicalRecords,
  };
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  getDailyReport,
  getRecordDate,
  isSameDate,
  indiaDate,
  normalizeMembership,
  normalizeDonation,
  normalizeMedical,
};
