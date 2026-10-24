const { readCorrected } = require("../models/records");
const { realDate } = require("../utils/validation");
const enquiryModel = require("../models/enquiryModel");
const { listUsers } = require("../models/userModel");
const { listPledges } = require("./pledgeService");
const { listPending } = require("../models/pendingPaymentStore");
const { donationPages, GENERAL_CAUSE } = require("../config/trustConfig");
const {
  normalizeMembership,
  normalizeDonation,
  normalizeMedical,
  getRecordDate,
  isSameDate,
} = require("./adminReportService");

// ============================================================
// ADMIN DASHBOARD DATA
// ============================================================
//
// Totals cover everything (or one day when a date is chosen); lists
// show one tab at a time, newest first, PAGE_SIZE rows per page.
// The full data is available through the CSV exports.
// ============================================================

const PAGE_SIZE = 50;

const VIEWS = [
  "donations",
  "memberships",
  "unfinished",
  "medical",
  "volunteers",
  "messages",
];

const isSuccess = (record) =>
  String(record.paymentStatus || "SUCCESS").toUpperCase() === "SUCCESS";

// Sort keys are worked out once per record, not on every comparison
function newestFirst(records) {
  return records
    .map((record) => ({ record, time: getRecordDate(record)?.getTime() || 0 }))
    .sort((a, b) => b.time - a.time)
    .map((item) => item.record);
}

const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);

// Records of one day (YYYY-MM-DD), or all records when no date is given
function onDate(records, date) {
  return date ? records.filter((record) => isSameDate(record, date)) : records;
}

// Matches field values only (not field names or JSON punctuation), and
// never the full Aadhaar number, which the dashboard shows masked
function search(rows, query) {
  const q = String(query || "")
    .slice(0, 100)
    .trim()
    .toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    Object.entries(row)
      .filter(([key]) => key !== "aadharNumber")
      .some(([, value]) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      ),
  );
}

function paginate(rows, page) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (current - 1) * PAGE_SIZE;

  return {
    rows: rows.slice(start, start + PAGE_SIZE),
    total: rows.length,
    page: current,
    pages,
  };
}

async function getDashboard({ date = "", view = "donations", q = "", page = 1 } = {}) {
  const day = realDate(date) ? date : "";
  const tab = VIEWS.includes(view) ? view : "donations";

  const [
    payments,
    donationRecords,
    medicalRecords,
    volunteers,
    messages,
    users,
    pledges,
    pending,
  ] = await Promise.all([
    readCorrected("payment.txt"),
    readCorrected("donations.txt"),
    readCorrected("user.txt"),
    enquiryModel.listVolunteers(),
    enquiryModel.listMessages(),
    listUsers(),
    listPledges(),
    listPending(),
  ]);

  const memberships = newestFirst(onDate(payments.filter(isSuccess), day));
  const donations = newestFirst(onDate(donationRecords.filter(isSuccess), day));
  const medical = newestFirst(
    onDate(
      medicalRecords.filter((r) => String(r.type || "").toUpperCase() === "MEDICAL_HELP"),
      day,
    ),
  );
  // Started but not saved as paid: shows when PayU never confirmed a payment
  const paid = new Set(
    [...payments, ...donationRecords].map((r) =>
      String(r.transactionId || r.txnid || ""),
    ),
  );
  const unfinished = newestFirst(
    onDate(
      pending.filter((r) => !paid.has(String(r.txnid))),
      day,
    ),
  );
  const dayVolunteers = onDate(volunteers, day);
  const dayMessages = onDate(messages, day);

  const membershipAmount = sum(memberships);
  const donationAmount = sum(donations);

  const stats = {
    totalCollection: membershipAmount + donationAmount,
    donationCount: donations.length,
    donationAmount,
    membershipCount: memberships.length,
    membershipAmount,
    medicalCount: medical.length,
    volunteerCount: dayVolunteers.length,
    messageCount: dayMessages.length,
    userCount: users.length,
    activePledges: pledges.filter((p) => p.active).length,
    unfinishedCount: unfinished.length,
  };

  const funds = donationPages.map((p) => {
    const items = donations.filter((d) => (d.cause || GENERAL_CAUSE) === p.title);
    return { cause: p.title, count: items.length, amount: sum(items) };
  });

  // Search and page on the raw records; format only the rows shown
  const lists = {
    donations: [
      donations,
      (r) => ({ ...normalizeDonation(r), gotra: r.gotra || "", pan: r.pan || "" }),
    ],
    memberships: [memberships, normalizeMembership],
    unfinished: [
      unfinished,
      (r) => ({
        kind: r.type === "DONATION" ? "Donation" : "Membership",
        name: r.donorName || r.memberName || "",
        phoneNumber: r.phoneNumber || "",
        email: r.email || "",
        amount: Number(r.amount) || 0,
        cause: r.cause || "",
        txnid: r.txnid,
        startedAt: r.createdAt,
      }),
    ],
    medical: [medical, normalizeMedical],
    volunteers: [newestFirst(dayVolunteers), (r) => r],
    messages: [newestFirst(dayMessages), (r) => r],
  };

  const [records, format] = lists[tab];
  const list = paginate(search(records, q), page);
  list.rows = list.rows.map(format);

  return {
    date: day,
    view: tab,
    q: String(q || "").slice(0, 100),
    views: VIEWS,
    stats,
    funds,
    list,
  };
}

module.exports = { getDashboard, PAGE_SIZE };
