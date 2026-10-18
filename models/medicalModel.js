const { appendRecord } = require("./fileStore");

const {
  required,
  phone,
  email,
  aadhar,
  pastDate,
  accepted,
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
      throw new Error(
        `${field} is required`
      );
    }
  }

  for (const field of [...fields, "patientReferenceName"]) {
    if (String(data[field] || "").trim().length > 150) {
      throw new Error(
        `${field} is too long`
      );
    }
  }

  if (!pastDate(data.dateBirth)) {
    throw new Error(
      "Please enter a valid date of birth"
    );
  }

  if (!accepted(data.consent)) {
    throw new Error(
      "Please accept the Terms and Privacy Policy"
    );
  }

  // ----------------------------------------------------------
  // AADHAAR VALIDATION
  // ----------------------------------------------------------

  if (!aadhar(data.aadharNumber)) {
    throw new Error(
      "Aadhar number must be 12 digits"
    );
  }

  // ----------------------------------------------------------
  // PHONE VALIDATION
  // ----------------------------------------------------------

  if (!phone(data.patientPhoneNumber)) {
    throw new Error(
      "Phone number must be 10 digits"
    );
  }

  // ----------------------------------------------------------
  // EMAIL VALIDATION
  // ----------------------------------------------------------

  if (!email(data.patientEmail)) {
    throw new Error(
      "Please enter a valid email address"
    );
  }

  // ----------------------------------------------------------
  // SAVE MEDICAL HELP RECORD
  // ----------------------------------------------------------

  return appendRecord(
    "user.txt",
    {
      type: "MEDICAL_HELP",

      patientName:
        String(
          data.patientName
        ).trim(),

      aadharNumber:
        String(
          data.aadharNumber
        ).trim(),

      dateBirth:
        String(
          data.dateBirth
        ).trim(),

      patientReferenceName:
        String(
          data.patientReferenceName || ""
        ).trim(),

      patientPhoneNumber:
        String(
          data.patientPhoneNumber
        ).trim(),

      patientEmail:
        String(
          data.patientEmail
        ).trim(),

      nameDiseases:
        String(
          data.nameDiseases
        ).trim(),

      hospitalName:
        String(
          data.hospitalName
        ).trim(),

      referenceRegistrationNumber:
        String(
          data.referenceRegistrationNumber ||
          "REF001"
        ).trim(),

      // ======================================================
      // SUBMISSION DATE & TIME
      // ======================================================

      submittedAt:
        new Date().toISOString(),
    }
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  create,
};