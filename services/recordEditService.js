const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { readCorrected, addEdit, ID_KEY } = require("../models/records");
const donationModel = require("../models/donationModel");
const membershipModel = require("../models/membershipModel");
const store = require("../models/pendingPaymentStore");
const donationService = require("./donationService");
const membershipService = require("./membershipService");
const medicalService = require("./medicalService");
const userAuthService = require("./userAuthService");
const pledgeService = require("./pledgeService");
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
const name =
  (max = 100) =>
  (value) =>
    !value
      ? "Name is required."
      : value.length > max || !personName(value)
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
      ["donorName", "Donor name", name()],
      ["email", "Email", mail],
      ["phoneNumber", "Mobile number", mobile],
      ["address", "Address", text(300)],
      ["pan", "PAN", pan],
      ["dedicationType", "Dedication", dedication],
      ["dedicatedTo", "Dedicated to", text(100)],
      ["gotra", "Gotra", text(50)],
    ],
    async afterSave(record, { resend, emailChanged, previous }) {
      // The certificate carries the name; print it again on next download
      const safeId = String(record.transactionId).replace(/[^A-Za-z0-9_-]/g, "_");
      await fs
        .unlink(path.join(dataDir, "receipts", `donation-certificate-${safeId}.pdf`))
        .catch(() => {});

      if (emailChanged) {
        // Monthly reminders are kept per email: if the donor had stopped
        // them, they stay stopped at the corrected address
        if (
          record.monthly &&
          (await pledgeService.wasStopped(
            previous.email,
            record.cause,
            record.paymentDate,
          ))
        ) {
          await pledgeService.cancelPledge(record.email, record.cause);
        }
        await userAuthService.ensureAccountForPayment({
          name: record.donorName,
          email: record.email,
          phone: record.phoneNumber,
          lang: record.lang,
        });
      }
      if (resend) {
        const certificatePath = await donationService.getCertificatePath(
          record.transactionId,
        );
        await sendDonationCertificateEmail({ donation: record, certificatePath });
      }
    },
  },

  membership: {
    title: "Membership",
    file: "payment.txt",
    find: (id) => membershipModel.findByTransactionId(id),
    emailField: "email",
    fields: [
      ["memberName", "Member name", name()],
      ["email", "Email", mail],
      ["phoneNumber", "Mobile number", mobile],
    ],
    async afterSave(record, { resend, emailChanged }) {
      store.deleteReceipt(record.transactionId);

      if (emailChanged) {
        await userAuthService.ensureAccountForPayment({
          name: record.memberName,
          email: record.email,
          phone: record.phoneNumber,
          lang: record.lang,
        });
      }
      if (resend) {
        const receipt = await membershipService.getReceipt(record.transactionId);
        await membershipService.sendMembershipEmail(
          { ...record, donorName: record.memberName },
          { txnid: record.transactionId, mihpayid: record.payuPaymentId },
          receipt.pdfBuffer,
        );
      }
    },
  },

  medical: {
    title: "Medical request",
    file: "user.txt",
    // Old records may share a reference (e.g. "REF001"); those cannot be
    // told apart, so they are not editable
    find: async (id) => {
      const matches = (await readCorrected("user.txt")).filter(
        (r) => r.type === "MEDICAL_HELP" && r.referenceRegistrationNumber === id,
      );
      return matches.length === 1 ? matches[0] : null;
    },
    // A record from before receipt links had a secret key gets one now,
    // so reprinting it does not create a guessable public file
    extraChanges: (record) =>
      record.receiptFile
        ? {}
        : {
            receiptFile: `Medical-Help-Receipt-${record.referenceRegistrationNumber}-${crypto.randomBytes(16).toString("hex")}.pdf`,
          },
    emailField: "patientEmail",
    fields: [
      ["patientName", "Patient name", name(150)],
      ["patientEmail", "Email", mail],
      ["patientPhoneNumber", "Mobile number", mobile],
      ["patientReferenceName", "Referred by", text(150)],
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
    const isEmail = field.toLowerCase().includes("email");
    if (field === "pan") value = value.toUpperCase();
    if (isEmail) value = value.toLowerCase();
    // +91 98765 43210 or 098765 43210 -> 9876543210
    if (field.toLowerCase().includes("phone")) {
      value = value.replace(/\D/g, "").replace(/^(?:91|0)(?=\d{10}$)/, "");
    }

    const problem = check(value);
    if (problem) throw invalid(`${label}: ${problem}`);

    const old = String(record[field] ?? "");
    // Emails were saved as typed; "Rahul@Gmail.com" is not a change
    if (isEmail ? value !== old.toLowerCase() : value !== old) {
      changes[field] = value;
      previous[field] = record[field] ?? "";
      if (ALSO[field]) changes[ALSO[field]] = value;
    }
  }

  const reason = String(input.reason || "")
    .trim()
    .slice(0, 200);
  const changed = Object.keys(changes).length > 0;
  if (changed && spec.extraChanges) Object.assign(changes, spec.extraChanges(record));

  // The record's own id (older membership records only have txnid)
  const target = record[ID_KEY[spec.file]] ?? record.txnid ?? id;
  if (changed) {
    await addEdit(spec.file, target, changes, { ...previous, reason });
  }

  const updated = { ...record, ...changes };
  const resend = input.resend === "on";
  let sendFailed = false;

  // The correction is saved; an email or PDF problem must not hide that
  if (changed || resend) {
    try {
      await spec.afterSave(updated, {
        resend,
        emailChanged: spec.emailField in changes,
        previous,
      });
    } catch (error) {
      console.error("❌ After-correction step failed:", error.message);
      sendFailed = true;
    }
  }

  return { changed, resend, sendFailed };
}

module.exports = { KINDS, load, save };
