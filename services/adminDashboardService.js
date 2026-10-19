const { realDate } = require("../utils/validation");
const { readRecords } = require("../models/fileStore");
const enquiryModel = require("../models/enquiryModel");
const { listUsers } = require("../models/userModel");
const { listPledges } = require("./pledgeService");
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

const VIEWS = ["donations", "memberships", "medical", "volunteers", "messages"];

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

function search(rows, query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
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
  ] = await Promise.all([
    readRecords("payment.txt"),
    readRecords("donations.txt"),
    readRecords("user.txt"),
    enquiryModel.listVolunteers(),
    enquiryModel.listMessages(),
    listUsers(),
    listPledges(),
  ]);

  const memberships = newestFirst(onDate(payments.filter(isSuccess), day));
  const donations = newestFirst(onDate(donationRecords.filter(isSuccess), day));
  const medical = newestFirst(
    onDate(
      medicalRecords.filter((r) => String(r.type || "").toUpperCase() === "MEDICAL_HELP"),
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
