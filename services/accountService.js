const { readCorrected } = require("../models/records");

const {
  normalizeMembership,
  normalizeDonation,
  normalizeMedical,
} = require("./adminReportService");

function sameEmail(a, b) {
  return (
    String(a || "")
      .trim()
      .toLowerCase() ===
    String(b || "")
      .trim()
      .toLowerCase()
  );
}

function isSuccess(record) {
  return String(record.paymentStatus || "SUCCESS").toUpperCase() === "SUCCESS";
}

function newestFirst(records) {
  const time = (r) =>
    new Date(r.paymentDate || r.submittedAt || r.createdAt || 0).getTime() || 0;
  return [...records].sort((a, b) => time(b) - time(a));
}

// Everything a logged-in user has done with the trust, matched by email
async function getActivity(email) {
  const [payments, donations, medical] = await Promise.all([
    readCorrected("payment.txt"),
    readCorrected("donations.txt"),
    readCorrected("user.txt"),
  ]);

  const memberships = newestFirst(
    payments.filter((r) => isSuccess(r) && sameEmail(r.email, email)),
  ).map(normalizeMembership);

  const userDonations = newestFirst(
    donations.filter((r) => isSuccess(r) && sameEmail(r.email, email)),
  ).map(normalizeDonation);

  const medicalRequests = newestFirst(
    medical.filter(
      (r) =>
        String(r.type || "").toUpperCase() === "MEDICAL_HELP" &&
        sameEmail(r.patientEmail, email),
    ),
  ).map(normalizeMedical);

  const sum = (items) =>
    items.reduce((total, item) => total + Number(item.amount || 0), 0);

  return {
    memberships,
    donations: userDonations,
    medicalRequests,
    totalGiven: sum(memberships) + sum(userDonations),
  };
}

module.exports = { getActivity };
