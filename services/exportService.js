const { readCorrected } = require("../models/records");
const enquiryModel = require("../models/enquiryModel");
const contentModel = require("../models/contentModel");
const { toCsv } = require("../utils/csv");
const { realDate } = require("../utils/validation");
const {
  donationPages,
  GENERAL_CAUSE,
  eightyG,
  eightyGCovers,
  financialYear,
} = require("../config/trustConfig");

const {
  normalizeMembership,
  normalizeDonation,
  normalizeMedical,
  indiaDate,
} = require("./adminReportService");

// Stored times are UTC; a sign-up at 1:30 AM in India belongs to that day
const day = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? indiaDate(date) : "";
};

const isSuccess = (r) => String(r.paymentStatus || "SUCCESS").toUpperCase() === "SUCCESS";

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (India dates, both optional and inclusive)
function inRange(query = {}) {
  const from = realDate(query.from) ? query.from : "";
  const to = realDate(query.to) ? query.to : "";
  return (record) => {
    const d = day(record.paymentDate || record.createdAt);
    return (!from || d >= from) && (!to || d <= to);
  };
}

async function successfulDonations(query) {
  return (await readCorrected("donations.txt")).filter(isSuccess).filter(inRange(query));
}

// Each export: file name and a function returning CSV text
const exports_ = {
  donations: async (query) => {
    const rows = (await successfulDonations(query)).map((r) => ({
      ...normalizeDonation(r),
      raw: r,
    }));
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

  memberships: async (query) => {
    const rows = (await readCorrected("payment.txt"))
      .filter(isSuccess)
      .filter(inRange(query))
      .map(normalizeMembership);
    return toCsv(rows, [
      ["Date", (r) => r.date],
      ["Member", (r) => r.memberName],
      ["Phone", (r) => r.phoneNumber],
      ["Email", (r) => r.email],
      ["Membership", (r) => r.membershipType],
      ["Valid Till", (r) => r.validTill],
      ["Amount", (r) => r.amount],
      ["Payment Mode", (r) => r.paymentMode],
      ["Transaction ID", (r) => r.transactionId],
      ["PayU Payment ID", (r) => r.payuPaymentId],
    ]);
  },

  medical: async () => {
    const rows = (await readCorrected("user.txt"))
      .filter((r) => String(r.type || "").toUpperCase() === "MEDICAL_HELP")
      .map(normalizeMedical);
    return toCsv(rows, [
      ["Date", (r) => r.date],
      ["Reference", (r) => r.referenceRegistrationNumber],
      ["Patient", (r) => r.patientName],
      // Only the last 4 digits leave the system
      [
        "Aadhaar (last 4)",
        (r) => (r.aadharNumber ? `XXXX-XXXX-${r.aadharNumber.slice(-4)}` : ""),
      ],
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
      ["Date", (r) => day(r.createdAt)],
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
      ["Date", (r) => day(r.createdAt)],
      ["Type", (r) => r.enquiryType],
      ["Name", (r) => r.name],
      ["Organisation", (r) => r.organisation],
      ["Phone", (r) => r.phone],
      ["Email", (r) => r.email],
      ["Message", (r) => r.message],
    ]),

  "event-registrations": async () =>
    toCsv(await contentModel.listRegistrations(), [
      ["Date", (r) => day(r.createdAt)],
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
    const religious = new Set(
      donationPages.filter((p) => p.donation.religious).map((p) => p.title),
    );
    // "2026-27": the second year must follow the first
    const m = /^(\d{4})-(\d{2})$/.exec(query.fy || "");
    const fy =
      m && (Number(m[1]) + 1) % 100 === Number(m[2])
        ? query.fy
        : financialYear(new Date());

    const byPan = new Map();
    for (const d of await successfulDonations()) {
      const year = financialYear(d.paymentDate);
      // Only gifts inside the 80G approval period count as 80G donations
      if (
        !d.pan ||
        religious.has(d.cause) ||
        year !== fy ||
        !eightyGCovers(d.paymentDate)
      )
        continue;
      const row = byPan.get(d.pan) || {
        pan: d.pan,
        name: d.donorName,
        address: d.address,
        amount: 0,
      };
      row.amount += Number(d.amount || 0);
      row.address = row.address || d.address;
      byPan.set(d.pan, row);
    }

    let sr = 0;
    return toCsv(
      [...byPan.values()],
      [
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
        [
          "Mode of Receipt",
          () => "Electronic modes including account payee cheque/draft",
        ],
        ["Amount of Donation (Indian rupees)", (r) => r.amount],
      ],
    );
  },

  "monthly-pledges": async () =>
    toCsv(await require("./pledgeService").listPledges(), [
      ["Donor", (r) => r.name],
      ["Email", (r) => r.email],
      ["Fund", (r) => r.cause],
      ["Purpose", (r) => r.purpose],
      ["Amount", (r) => r.amount],
      ["Last Paid", (r) => day(r.lastPaid)],
      ["Next Due", (r) => day(r.nextDue)],
      ["Status", (r) => (r.active ? "Active" : "Stopped")],
    ]),

  funds: async (query) => {
    const donations = await successfulDonations(query);
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

// Form 10BD needs the trust's 80G URN, so it stays hidden until approval
const exportTypes = () =>
  Object.keys(exports_).filter((type) => type !== "form-10bd" || eightyG.approved);

async function buildExport(type, query) {
  if (!exportTypes().includes(type)) return null;
  return exports_[type](query);
}

module.exports = { buildExport, exportTypes, successfulDonations };
