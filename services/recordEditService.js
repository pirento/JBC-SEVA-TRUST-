const fs = require("fs/promises");
const path = require("path");

const { readCorrected, addEdit } = require("../models/records");
const donationModel = require("../models/donationModel");
const membershipModel = require("../models/membershipModel");
const store = require("../models/pendingPaymentStore");
const donationService = require("./donationService");
const membershipService = require("./membershipService");
const medicalService = require("./medicalService");
const userAuthService = require("./userAuthService");
const { sendDonationCertificateEmail } = require("./donationEmailService");
const { dataDir } = require("../config/appConfig");
const { dedicationTypes } = require("../config/trustConfig");
const { phone, email, personName } = require("../utils/validation");

// ========================================
// ADMIN CORRECTIONS
// ========================================
//
// The admin can fix the details a person typed (a wrong email, a
// spelling). Amounts, causes and payment details are never editable.
// Each save is an EDIT record (models/records.js), so the original
// stays on file and the page shows the history.
// ========================================

const text = (max) => (value) =>
  value.length > max ? `Must be at most ${max} characters.` : null;
const name = (value) =>
  !value
    ? "Name is required."
    : value.length > 100 || !personName(value)
      ? "Please enter a valid name."
      : null;
const mail = (value) => (email(value) ? null : "Please enter a valid email address.");
const mobile = (value) =>
  phone(value) ? null : "Please enter a valid 10 digit mobile number.";
const pan = (value) =>
  !value || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value) ? null : "Please enter a valid PAN.";
const dedication = (value) =>
  !value || dedicationTypes.includes(value) ? null : "Please choose a valid dedication.";

const KINDS = {
  donation: {
    title: "Donation",
    file: "donations.txt",
    find: (id) => donationModel.findByTransactionId(id),
    emailField: "email",
    fields: [
      ["donorName", "Donor name", name],
      ["email", "Email", mail],
      ["phoneNumber", "Mobile number", mobile],
      ["address", "Address", text(300)],
      ["pan", "PAN", pan],
      ["dedicationType", "Dedication", dedication],
      ["dedicatedTo", "Dedicated to", text(100)],
      ["gotra", "Gotra", text(50)],
    ],
    async afterSave(record, { resend, emailChanged }) {
      // The certificate carries the name; print it again on next download
      const safeId = String(record.transactionId).replace(/[^A-Za-z0-9_-]/g, "_");
      await fs
        .unlink(path.join(dataDir, "receipts", `donation-certificate-${safeId}.pdf`))
        .catch(() => {});

      if (resend) {
        const certificatePath = await donationService.getCertificatePath(
          record.transactionId,
        );
        await sendDonationCertificateEmail({ donation: record, certificatePath });
      }
      if (emailChanged) {
        await userAuthService.ensureAccountForPayment({
          name: record.donorName,
          email: record.email,
          phone: record.phoneNumber,
          lang: record.lang,
        });
      }
    },
  },

  membership: {
    title: "Membership",
    file: "payment.txt",
    find: (id) => membershipModel.findByTransactionId(id),
    emailField: "email",
    fields: [
      ["memberName", "Member name", name],
      ["email", "Email", mail],
      ["phoneNumber", "Mobile number", mobile],
    ],
    async afterSave(record, { resend, emailChanged }) {
      store.deleteReceipt(record.transactionId);

      if (resend) {
        const receipt = await membershipService.getReceipt(record.transactionId);
        await membershipService.sendMembershipEmail(
          { ...record, donorName: record.memberName },
          { txnid: record.transactionId, mihpayid: record.payuPaymentId },
          receipt.pdfBuffer,
        );
      }
      if (emailChanged) {
        await userAuthService.ensureAccountForPayment({
          name: record.memberName,
          email: record.email,
          phone: record.phoneNumber,
          lang: record.lang,
        });
      }
    },
  },

  medical: {
    title: "Medical request",
    file: "user.txt",
    find: async (id) =>
      (await readCorrected("user.txt")).find(
        (r) => r.type === "MEDICAL_HELP" && r.referenceRegistrationNumber === id,
      ) || null,
    emailField: "patientEmail",
    fields: [
      ["patientName", "Patient name", name],
      ["patientEmail", "Email", mail],
      ["patientPhoneNumber", "Mobile number", mobile],
      ["patientReferenceName", "Referred by", text(100)],
      ["hospitalName", "Hospital", text(150)],
      ["nameDiseases", "Illness", text(150)],
    ],
    async afterSave(record, { resend }) {
      const { fileName, pdfBuffer } = await medicalService.regenerateReceipt(record);
      if (resend) {
        await medicalService.sendMedicalEmail(
          record,
          record.referenceRegistrationNumber,
          fileName,
          pdfBuffer,
        );
      }
    },
  },
};

// Membership records kept the name in donorName too (older code reads it)
const ALSO = { memberName: "donorName" };

function invalid(message) {
  return Object.assign(new Error(message), { expose: true });
}

async function load(kind, id) {
  const spec = KINDS[kind];
  if (!spec) return null;
  const record = await spec.find(String(id || ""));
  return record ? { spec, record } : null;
}

async function save(kind, id, input) {
  const found = await load(kind, id);
  if (!found) return null;
  const { spec, record } = found;

  const changes = {};
  const previous = {};
  for (const [field, label, check] of spec.fields) {
    let value = String(input[field] ?? "").trim();
    if (field === "pan") value = value.toUpperCase();
    if (field.toLowerCase().includes("email")) value = value.toLowerCase();

    const problem = check(value);
    if (problem) throw invalid(`${label}: ${problem}`);

    if (value !== String(record[field] ?? "")) {
      changes[field] = value;
      previous[field] = record[field] ?? "";
      if (ALSO[field]) changes[ALSO[field]] = value;
    }
  }

  const reason = String(input.reason || "")
    .trim()
    .slice(0, 200);
  const changed = Object.keys(changes).length > 0;

  if (changed) {
    await addEdit(spec.file, id, changes, { ...previous, reason });
  }

  const updated = { ...record, ...changes };
  const resend = input.resend === "on";
  if (changed || resend) {
    await spec.afterSave(updated, {
      resend,
      emailChanged: spec.emailField in changes,
    });
  }

  return { changed, resend };
}

module.exports = { KINDS, load, save };
