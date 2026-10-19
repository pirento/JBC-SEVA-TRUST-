const cron = require("node-cron");

const { appendRecord, readRecords } = require("../models/fileStore");
const { sendEmail } = require("./emailService");
const { appUrl } = require("../config/appConfig");
const { donationPages, GENERAL_CAUSE } = require("../config/trustConfig");

// Monthly giving without auto-debit: a successful donation marked
// "monthly" starts a pledge; each month the donor gets an email with
// a link to pay again. CANCEL and REMINDER records live in pledges.txt.
//
// shortcut: reminder emails, not automatic debits. Switch to PayU
// standing instructions once the merchant account is enabled for it.

const FILE = "pledges.txt";
const DAY = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS = 30;

const keyOf = (email, cause) =>
  `${String(email).toLowerCase()}|${cause || GENERAL_CAUSE}`;
const time = (value) => new Date(value || 0).getTime() || 0;

async function listPledges() {
  const [donations, events] = await Promise.all([
    readRecords("donations.txt"),
    readRecords(FILE),
  ]);

  const pledges = new Map();
  for (const d of donations) {
    if (
      !d.monthly ||
      String(d.paymentStatus || "SUCCESS").toUpperCase() !== "SUCCESS" ||
      !d.email
    )
      continue;
    const key = keyOf(d.email, d.cause);
    const current = pledges.get(key);
    if (!current || time(d.paymentDate) > time(current.lastPaid)) {
      pledges.set(key, {
        key,
        email: String(d.email).toLowerCase(),
        name: d.donorName,
        cause: d.cause || GENERAL_CAUSE,
        purpose: d.purpose || "",
        amount: Number(d.amount),
        lastPaid: d.paymentDate,
      });
    }
  }

  for (const pledge of pledges.values()) {
    const mine = events.filter((e) => e.key === pledge.key);
    const lastCancel = Math.max(
      0,
      ...mine.filter((e) => e.type === "CANCEL").map((e) => time(e.createdAt)),
    );
    pledge.active = lastCancel < time(pledge.lastPaid);
    pledge.lastReminder = Math.max(
      0,
      ...mine.filter((e) => e.type === "REMINDER").map((e) => time(e.createdAt)),
    );
    pledge.nextDue = new Date(time(pledge.lastPaid) + INTERVAL_DAYS * DAY).toISOString();
  }

  return [...pledges.values()];
}

async function pledgesFor(email) {
  return (await listPledges()).filter(
    (p) => p.email === String(email).toLowerCase() && p.active,
  );
}

async function cancelPledge(email, cause) {
  await appendRecord(FILE, {
    type: "CANCEL",
    key: keyOf(email, cause),
    createdAt: new Date().toISOString(),
  });
}

function payLink(pledge) {
  const page = donationPages.find((p) => p.title === pledge.cause) || donationPages[0];
  const query = new URLSearchParams({
    amount: String(Math.round(pledge.amount)),
    monthly: "1",
  });
  if (pledge.purpose) query.set("purpose", pledge.purpose);
  return `${appUrl}/donate/${page.slug}?${query}`;
}

// Due when a month has passed since the last payment and no reminder
// has gone out since then
function isDue(pledge, now = Date.now()) {
  return (
    pledge.active &&
    now - time(pledge.lastPaid) >= INTERVAL_DAYS * DAY &&
    pledge.lastReminder < Math.max(time(pledge.lastPaid), now - INTERVAL_DAYS * DAY)
  );
}

async function sendDueReminders(now = Date.now()) {
  const due = (await listPledges()).filter((p) => isDue(p, now));

  for (const pledge of due) {
    const link = payLink(pledge);
    try {
      await sendEmail({
        to: pledge.email,
        subject: `Your monthly gift to ${pledge.cause} - JBC Seva Trust`,
        text:
          `Namaste ${pledge.name},\n\nThank you for giving to ${pledge.cause} every month. ` +
          `Your next gift of Rs. ${pledge.amount} is due. Pay securely here:\n${link}\n\n` +
          `To stop these reminders, log in at ${appUrl}/account and choose "Stop".\n\nJBC Seva Trust`,
      });
    } catch (error) {
      // Still record it, so a broken mail setup does not resend daily
      console.error("❌ Monthly reminder email failed:", error.message);
    }
    await appendRecord(FILE, {
      type: "REMINDER",
      key: pledge.key,
      createdAt: new Date(now).toISOString(),
    });
  }

  return due.length;
}

function startPledgeScheduler() {
  cron.schedule(
    "0 10 * * *",
    () => {
      sendDueReminders().catch((error) =>
        console.error("❌ Monthly reminders failed:", error.message),
      );
    },
    { timezone: "Asia/Kolkata" },
  );
}

module.exports = {
  listPledges,
  pledgesFor,
  cancelPledge,
  sendDueReminders,
  startPledgeScheduler,
  payLink,
  isDue,
};
