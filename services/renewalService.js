const cron = require("node-cron");

const { readCorrected } = require("../models/records");
const { appendRecord, readRecords } = require("../models/fileStore");
const { sendEmail } = require("./emailService");
const { renderEmail } = require("./emailTemplate");
const { appUrl } = require("../config/appConfig");
const {
  normalizeMembership,
  membershipEnd,
  getRecordDate,
} = require("./adminReportService");

// ============================================================
// MEMBERSHIP RENEWAL REMINDERS
// ============================================================
//
// A 1-year member gets one email in the last 30 days of the membership,
// with a link to renew. Only each email's newest membership counts, so
// someone who already renewed is not reminded. Sent reminders are
// logged in renewals.txt (one per membership transaction).
// ============================================================

const FILE = "renewals.txt";
const DAY = 24 * 60 * 60 * 1000;
const NOTICE_DAYS = 30;

const time = (record) => getRecordDate(record)?.getTime() || 0;

// Newest paid membership per email whose year ends within NOTICE_DAYS
async function dueRenewals(now = Date.now()) {
  const [payments, sent] = await Promise.all([
    readCorrected("payment.txt"),
    readRecords(FILE),
  ]);
  const reminded = new Set(sent.map((r) => r.transactionId));

  const newest = new Map();
  for (const record of payments) {
    if (String(record.paymentStatus || "SUCCESS").toUpperCase() !== "SUCCESS") continue;
    const email = String(record.email || "").toLowerCase();
    if (!email) continue;
    if (!newest.has(email) || time(record) > time(newest.get(email))) {
      newest.set(email, record);
    }
  }

  return [...newest.values()]
    .map((record) => ({ record, member: normalizeMembership(record) }))
    .filter(({ record, member }) => {
      const end = membershipEnd(record, member.membershipType);
      return (
        end &&
        !reminded.has(member.transactionId) &&
        end.getTime() + DAY > now &&
        end.getTime() - now <= NOTICE_DAYS * DAY
      );
    });
}

async function sendRenewalReminders(now = Date.now()) {
  const due = await dueRenewals(now);

  for (const { record, member } of due) {
    try {
      const lang = record.lang === "hi" ? "hi" : "en";
      const { html, text } = renderEmail({
        lang,
        heading: "Your membership is ending soon",
        greeting:
          lang === "hi"
            ? `नमस्ते ${member.memberName},`
            : `Namaste ${member.memberName},`,
        paragraphs: [
          "Thank you for being a member of JBC Seva Trust. Your one-year membership ends soon; you can renew it with the button below.",
        ],
        rows: [
          ["Membership", member.membershipType],
          ["Valid till", member.validTill],
        ],
        button: { label: "Renew membership", url: `${appUrl}/donation` },
      });

      await sendEmail({
        to: member.email,
        subject:
          lang === "hi"
            ? "आपकी सदस्यता जल्द समाप्त हो रही है - JBC Seva Trust"
            : "Your membership is ending soon - JBC Seva Trust",
        text,
        html,
      });
    } catch (error) {
      // Still logged, so a broken mail setup does not resend every day
      console.error("❌ Renewal reminder email failed:", error.message);
    }
    await appendRecord(FILE, {
      type: "RENEWAL_REMINDER",
      transactionId: member.transactionId,
      createdAt: new Date(now).toISOString(),
    });
  }

  return due.length;
}

function startRenewalScheduler() {
  cron.schedule(
    "15 10 * * *",
    () => {
      sendRenewalReminders().catch((error) =>
        console.error("❌ Renewal reminders failed:", error.message),
      );
    },
    { timezone: "Asia/Kolkata" },
  );
}

module.exports = { dueRenewals, sendRenewalReminders, startRenewalScheduler };
