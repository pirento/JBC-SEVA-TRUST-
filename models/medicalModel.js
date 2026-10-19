const { readCorrected } = require("./records");
const { appendRecord } = require("./fileStore");

const {
  required,
  phone,
  email,
  aadhar,
  pastDate,
  accepted,
  personName,
} = require("../utils/validation");

// ============================================================
// MEDICAL HELP FIELDS
// ============================================================

const fields = [
  "patientName",
  "aadharNumber",
  "dateBirth",
  "patientPhoneNumber",
  "patientEmail",
  "nameDiseases",
  "hospitalName",
];

// ============================================================
// CREATE MEDICAL HELP RECORD
// ============================================================

async function create(data) {
  // ----------------------------------------------------------
  // REQUIRED FIELD VALIDATION
  // ----------------------------------------------------------

  for (const field of fields) {
    if (!required(data[field])) {
      throw new Error(`${field} is required`);
    }
  }

  for (const field of [...fields, "patientReferenceName"]) {
    if (String(data[field] || "").trim().length > 150) {
      throw new Error(`${field} is too long`);
    }
  }

  if (!personName(data.patientName)) {
    throw new Error("Please enter a valid patient name");
  }

  if (!pastDate(data.dateBirth)) {
    throw new Error("Please enter a valid date of birth");
  }

  if (!accepted(data.consent)) {
    throw new Error("Please accept the Terms and Privacy Policy");
  }

  // ----------------------------------------------------------
  // AADHAAR VALIDATION
  // ----------------------------------------------------------

  if (!aadhar(data.aadharNumber)) {
    throw new Error(
      "Please enter a valid 12 digits Aadhaar number, as printed on the card",
    );
  }

  // ----------------------------------------------------------
  // PHONE VALIDATION
  // ----------------------------------------------------------

  if (!phone(data.patientPhoneNumber)) {
    throw new Error("Phone number must be 10 digits");
  }

  // ----------------------------------------------------------
  // EMAIL VALIDATION
  // ----------------------------------------------------------

  if (!email(data.patientEmail)) {
    throw new Error("Please enter a valid email address");
  }

  // ----------------------------------------------------------
  // DUPLICATE CHECK
  // ----------------------------------------------------------
  // One request per patient and hospital in 7 days is enough;
  // repeats are usually double clicks or impatience.

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const hospital = String(data.hospitalName).trim().toLowerCase();

  const duplicate = (await readCorrected("user.txt")).find(
    (record) =>
      record.type === "MEDICAL_HELP" &&
      record.aadharNumber === String(data.aadharNumber).trim() &&
      String(record.hospitalName).trim().toLowerCase() === hospital &&
      new Date(record.submittedAt).getTime() > weekAgo,
  );

  if (duplicate) {
    throw new Error(
      "A request for this patient and hospital was already received in the last 7 days. Our team will contact you.",
    );
  }

  // ----------------------------------------------------------
  // SAVE MEDICAL HELP RECORD
  // ----------------------------------------------------------

  return appendRecord("user.txt", {
    type: "MEDICAL_HELP",

    patientName: String(data.patientName).trim(),

    aadharNumber: String(data.aadharNumber).trim(),

    dateBirth: String(data.dateBirth).trim(),

    patientReferenceName: String(data.patientReferenceName || "").trim(),

    patientPhoneNumber: String(data.patientPhoneNumber).trim(),

    patientEmail: String(data.patientEmail).trim(),

    nameDiseases: String(data.nameDiseases).trim(),

    hospitalName: String(data.hospitalName).trim(),

    referenceRegistrationNumber: String(
      data.referenceRegistrationNumber || "REF001",
    ).trim(),

    // ======================================================
    // SUBMISSION DATE & TIME
    // ======================================================

    // Download name with a secret key (services/medicalService.js)
    receiptFile: String(data.receiptFile || ""),

    submittedAt: new Date().toISOString(),
  });
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  create,
};
