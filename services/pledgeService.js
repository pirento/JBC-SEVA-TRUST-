const cron = require("node-cron");

const { appendRecord, readRecords } = require("../models/fileStore");
const { sendEmail } = require("./emailService");
const { renderEmail, t } = require("./emailTemplate");
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

  const paid = donations.filter(
    (d) => d.email && String(d.paymentStatus || "SUCCESS").toUpperCase() === "SUCCESS",
  );

  const pledges = new Map();
  for (const d of paid) {
    if (!d.monthly) continue;
    const key = keyOf(d.email, d.cause);
    const current = pledges.get(key);
    if (!current || time(d.paymentDate) > time(current.lastPaid)) {
      pledges.set(key, {
        key,
        email: String(d.email).toLowerCase(),
        name: d.donorName,
        cause: d.cause || GENERAL_CAUSE,
        purpose: d.purpose || "",
        lang: d.lang || "en",
        amount: Number(d.amount),
        lastMonthly: d.paymentDate,
        lastPaid: d.paymentDate,
      });
    }
  }

  // This month's gift paid without ticking "monthly" still counts as
  // paid, so the donor is not reminded for a month they already gave
  for (const d of paid) {
    const pledge = pledges.get(keyOf(d.email, d.cause));
    if (pledge && time(d.paymentDate) > time(pledge.lastPaid))
      pledge.lastPaid = d.paymentDate;
  }

  for (const pledge of pledges.values()) {
    const mine = events.filter((e) => e.key === pledge.key);
    const lastCancel = Math.max(
      0,
      ...mine.filter((e) => e.type === "CANCEL").map((e) => time(e.createdAt)),
    );
    // Only a new monthly gift restarts stopped reminders, not a one-off one
    pledge.active = lastCancel < time(pledge.lastMonthly);
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
      const lang = pledge.lang === "hi" ? "hi" : "en";
      const { html, text } = renderEmail({
        lang,
        heading: "Your monthly gift is due",
        greeting: lang === "hi" ? `नमस्ते ${pledge.name},` : `Namaste ${pledge.name},`,
        paragraphs: [
          "Thank you for giving every month. Your next gift is due; you can pay securely with the button below.",
        ],
        rows: [
          ["Donated for", t(pledge.cause, lang)],
          ["Purpose", t(pledge.purpose, lang)],
          ["Amount", `₹${Number(pledge.amount).toFixed(2)}`],
        ],
        button: { label: "Give this month", url: link },
        note: "To stop these reminders, log in to My Account and choose Stop next to this monthly donation.",
      });

      await sendEmail({
        to: pledge.email,
        subject:
          lang === "hi"
            ? `${t(pledge.cause, lang)} के लिए आपका मासिक दान - JBC Seva Trust`
            : `Your monthly gift to ${pledge.cause} - JBC Seva Trust`,
        text,
        html,
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
