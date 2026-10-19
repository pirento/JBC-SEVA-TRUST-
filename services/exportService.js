const { readRecords } = require("../models/fileStore");
const enquiryModel = require("../models/enquiryModel");
const contentModel = require("../models/contentModel");
const { toCsv } = require("../utils/csv");
const { donationPages, GENERAL_CAUSE, eightyG } = require("../config/trustConfig");

// Indian financial year (April-March) of a date, e.g. "2026-27"
function financialYear(dateValue) {
  const d = new Date(dateValue);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}
const {
  normalizeMembership,
  normalizeDonation,
  normalizeMedical,
} = require("./adminReportService");

const isSuccess = (r) => String(r.paymentStatus || "SUCCESS").toUpperCase() === "SUCCESS";

async function successfulDonations() {
  return (await readRecords("donations.txt")).filter(isSuccess);
}

// Each export: file name and a function returning CSV text
const exports_ = {
  donations: async () => {
    const rows = (await successfulDonations()).map((r) => ({ ...normalizeDonation(r), raw: r }));
    return toCsv(rows, [
      ["Date", (r) => r.date],
      ["Time", (r) => r.time],
      ["Donor", (r) => r.donorName],
      ["Phone", (r) => r.phoneNumber],
      ["Email", (r) => r.email],
      ["PAN", (r) => r.raw.pan],
      ["Address", (r) => r.raw.address],
      ["Fund", (r) => r.cause || GENERAL_CAUSE],
      ["Purpose", (r) => r.purpose],
      ["Dedication", (r) => r.dedication],
      ["Seva Date", (r) => r.sevaDate],
      ["Gotra", (r) => r.raw.gotra],
      ["Monthly", (r) => (r.raw.monthly ? "Yes" : "")],
      ["Amount", (r) => r.amount],
      ["Payment Mode", (r) => r.paymentMode],
      ["Transaction ID", (r) => r.transactionId],
      ["PayU Payment ID", (r) => r.payuPaymentId],
      ["Message", (r) => r.message],
    ]);
  },

  memberships: async () => {
    const rows = (await readRecords("payment.txt")).filter(isSuccess).map(normalizeMembership);
    return toCsv(rows, [
      ["Date", (r) => r.date],
      ["Member", (r) => r.memberName],
      ["Phone", (r) => r.phoneNumber],
      ["Email", (r) => r.email],
      ["Membership", (r) => r.membershipType],
      ["Amount", (r) => r.amount],
      ["Payment Mode", (r) => r.paymentMode],
      ["Transaction ID", (r) => r.transactionId],
      ["PayU Payment ID", (r) => r.payuPaymentId],
    ]);
  },

  medical: async () => {
    const rows = (await readRecords("user.txt"))
      .filter((r) => String(r.type || "").toUpperCase() === "MEDICAL_HELP")
      .map(normalizeMedical);
    return toCsv(rows, [
      ["Date", (r) => r.date],
      ["Reference", (r) => r.referenceRegistrationNumber],
      ["Patient", (r) => r.patientName],
      // Only the last 4 digits leave the system
      ["Aadhaar (last 4)", (r) => (r.aadharNumber ? `XXXX-XXXX-${r.aadharNumber.slice(-4)}` : "")],
      ["Date of Birth", (r) => r.dateBirth],
      ["Phone", (r) => r.patientPhoneNumber],
      ["Email", (r) => r.patientEmail],
      ["Illness", (r) => r.nameDiseases],
      ["Hospital", (r) => r.hospitalName],
      ["Referred By", (r) => r.patientReferenceName],
    ]);
  },

  volunteers: async () =>
    toCsv(await enquiryModel.listVolunteers(), [
      ["Date", (r) => r.createdAt],
      ["Name", (r) => r.name],
      ["Phone", (r) => r.phone],
      ["Email", (r) => r.email],
      ["Village / City", (r) => r.city],
      ["Areas", (r) => [].concat(r.areas || []).join("; ")],
      ["Availability", (r) => r.availability],
      ["Message", (r) => r.message],
    ]),

  messages: async () =>
    toCsv(await enquiryModel.listMessages(), [
      ["Date", (r) => r.createdAt],
      ["Type", (r) => r.enquiryType],
      ["Name", (r) => r.name],
      ["Organisation", (r) => r.organisation],
      ["Phone", (r) => r.phone],
      ["Email", (r) => r.email],
      ["Message", (r) => r.message],
    ]),

  "event-registrations": async () =>
    toCsv(await contentModel.listRegistrations(), [
      ["Date", (r) => r.createdAt],
      ["Event", (r) => r.eventTitle],
      ["Name", (r) => r.name],
      ["Phone", (r) => r.phone],
      ["Email", (r) => r.email],
      ["People", (r) => r.people],
      ["Role", (r) => r.role],
    ]),

  // Donor list in the shape of Form 10BD: one row per donor PAN,
  // charitable funds only (temple gifts are not 80G donations)
  "form-10bd": async (query = {}) => {
    const religious = new Set(donationPages.filter((p) => p.donation.religious).map((p) => p.title));
    const fy = /^\d{4}-\d{2}$/.test(query.fy || "") ? query.fy : financialYear(new Date());

    const byPan = new Map();
    for (const d of await successfulDonations()) {
      if (!d.pan || religious.has(d.cause) || financialYear(d.paymentDate) !== fy) continue;
      const row = byPan.get(d.pan) || { pan: d.pan, name: d.donorName, address: d.address, amount: 0 };
      row.amount += Number(d.amount || 0);
      row.address = row.address || d.address;
      byPan.set(d.pan, row);
    }

    let sr = 0;
    return toCsv([...byPan.values()], [
      ["Sr. No.", () => ++sr],
      ["Financial Year", () => fy],
      ["ID Code", () => "Permanent Account Number"],
      ["Unique Identification Number", (r) => r.pan],
      ["Section Code", () => "Section 80G"],
      ["Unique Registration Number (URN)", () => eightyG.registrationNumber],
      ["Date of Issuance of URN", () => eightyG.approvedOn],
      ["Name of Donor", (r) => r.name],
      ["Address of Donor", (r) => r.address],
      ["Donation Type", () => "Others"],
      ["Mode of Receipt", () => "Electronic modes including account payee cheque/draft"],
      ["Amount of Donation (Indian rupees)", (r) => r.amount],
    ]);
  },

  "monthly-pledges": async () =>
    toCsv(await require("./pledgeService").listPledges(), [
      ["Donor", (r) => r.name],
      ["Email", (r) => r.email],
      ["Fund", (r) => r.cause],
      ["Purpose", (r) => r.purpose],
      ["Amount", (r) => r.amount],
      ["Last Paid", (r) => r.lastPaid],
      ["Next Due", (r) => r.nextDue],
      ["Status", (r) => (r.active ? "Active" : "Stopped")],
    ]),

  funds: async () => {
    const donations = await successfulDonations();
    const rows = donationPages.map((page) => {
      const items = donations.filter((d) => (d.cause || GENERAL_CAUSE) === page.title);
      return {
        fund: page.title,
        count: items.length,
        amount: items.reduce((total, d) => total + Number(d.amount || 0), 0),
      };
    });
    return toCsv(rows, [
      ["Fund", (r) => r.fund],
      ["Donations", (r) => r.count],
      ["Amount", (r) => r.amount],
    ]);
  },
};

async function buildExport(type, query) {
  const build = exports_[type];
  if (!build) return null;
  return build(query);
}

module.exports = { buildExport, exportTypes: Object.keys(exports_), successfulDonations };
