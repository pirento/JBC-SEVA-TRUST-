const cron = require("node-cron");

const { getDailyReport } = require("./adminReportService");

const { generateDailyReportPdf } = require("./adminReportPdfService");

const { sendEmail } = require("./emailService");

const { appendRecord, readRecords } = require("../models/fileStore");

const { trustEmail: REPORT_EMAIL } = require("../config/emailConfig");
const { appUrl } = require("../config/appConfig");
const { renderEmail } = require("./emailTemplate");

// ============================================================
// GET TODAY'S DATE IN INDIA
// ============================================================

// A past date in India (1 = yesterday). The report runs just after
// midnight for the day that has fully ended, so a payment at 11:59:30 PM
// is not missed.
function getIndiaDate(daysAgo = 1) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000));
}

// ============================================================
// CHECK WHETHER REPORT EMAIL WAS ALREADY SENT
// ============================================================

async function isReportAlreadySent(reportDate) {
  try {
    const records = await readRecords("daily-report-email.txt");

    if (!Array.isArray(records)) {
      return false;
    }

    return records.some((record) => {
      return (
        record &&
        record.type === "DAILY_REPORT_EMAIL" &&
        record.reportDate === reportDate &&
        record.status === "SENT"
      );
    });
  } catch (error) {
    console.error("❌ Unable to check daily report email history:", error.message);

    return false;
  }
}

// ============================================================
// SEND DAILY REPORT
// ============================================================

// One report at a time: the 12:10 AM run and the startup catch-up can
// meet, and the already-sent check must see the earlier one's log
let queue = Promise.resolve();

function sendDailyReport(reportDate = getIndiaDate(1)) {
  const run = queue.then(() => runDailyReport(reportDate));
  queue = run.catch(() => {});
  return run;
}

// Every day after the last sent report, up to a week back, so a day
// missed by downtime or an email failure is still sent. With no report
// sent yet (a new site) only yesterday is sent.
async function catchUpReports() {
  const sent = (await readRecords("daily-report-email.txt").catch(() => []))
    .filter((record) => record?.type === "DAILY_REPORT_EMAIL" && record.status === "SENT")
    .map((record) => record.reportDate)
    .sort();
  const lastSent = sent.at(-1) || getIndiaDate(2);

  for (let daysAgo = 7; daysAgo >= 1; daysAgo -= 1) {
    const date = getIndiaDate(daysAgo);
    if (date > lastSent) await sendDailyReport(date);
  }
}

async function runDailyReport(reportDate) {
  console.log("=================================");
  console.log("📊 DAILY REPORT SCHEDULER");
  console.log("📅 Report Date:", reportDate);
  console.log("⏰ Time:", new Date().toLocaleString("en-IN"));
  console.log("=================================");

  // ----------------------------------------------------------
  // PREVENT DUPLICATE EMAIL
  // ----------------------------------------------------------

  const alreadySent = await isReportAlreadySent(reportDate);

  if (alreadySent) {
    console.log("⚠️ Daily report already sent for:", reportDate);

    return;
  }

  try {
    // --------------------------------------------------------
    // GET COMPLETE DAILY REPORT
    // --------------------------------------------------------

    const report = await getDailyReport(reportDate);

    console.log("👥 Memberships:", report.summary.membershipCount);

    console.log("💰 Membership Collection:", report.summary.membershipCollection);

    console.log("🎁 Donations:", report.summary.donationCount);

    console.log("💰 Donation Collection:", report.summary.donationCollection);

    console.log("🏥 Medical Requests:", report.summary.medicalCount);

    // --------------------------------------------------------
    // GENERATE DETAILED PDF
    // --------------------------------------------------------

    const pdfBuffer = await generateDailyReportPdf(report);

    console.log("📄 Daily report PDF generated");

    console.log("📦 PDF Size:", `${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // --------------------------------------------------------
    // EMAIL
    // --------------------------------------------------------

    const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
    const { html, text } = renderEmail({
      heading: `Daily report: ${reportDate}`,
      paragraphs: [
        `Summary for ${reportDate} is below. The detailed report is attached as a PDF.`,
      ],
      rows: [
        [
          "Donations",
          `${report.summary.donationCount} · ${money(report.summary.donationCollection)}`,
        ],
        [
          "Memberships",
          `${report.summary.membershipCount} · ${money(report.summary.membershipCollection)}`,
        ],
        ["Temple Fund (part of donations)", money(report.summary.templeCollection)],
        ["Total collection", money(report.summary.totalCollection)],
        ["Medical requests", String(report.summary.medicalCount)],
      ],
      button: {
        label: "Open admin dashboard",
        url: `${appUrl}/admin/dashboard?date=${reportDate}`,
      },
      closing: "Sent by the website",
    });

    await sendEmail({
      to: REPORT_EMAIL,

      subject: `Daily report ${reportDate} - JBC Seva Trust`,

      text,

      html,

      attachments: [
        {
          filename: `daily-report-${reportDate}.pdf`,

          content: pdfBuffer,

          contentType: "application/pdf",
        },
      ],
    });

    // --------------------------------------------------------
    // SAVE EMAIL SENT LOG
    // --------------------------------------------------------

    await appendRecord("daily-report-email.txt", {
      type: "DAILY_REPORT_EMAIL",

      reportDate,

      status: "SENT",

      recipient: REPORT_EMAIL,

      sentAt: new Date().toISOString(),

      membershipCount: report.summary.membershipCount,

      donationCount: report.summary.donationCount,

      medicalCount: report.summary.medicalCount,

      totalCollection: report.summary.totalCollection,
    });

    console.log("=================================");
    console.log("✅ DAILY REPORT EMAIL SENT");
    console.log("📅 Date:", reportDate);
    console.log("=================================");
  } catch (error) {
    console.error("=================================");
    console.error("❌ DAILY REPORT EMAIL FAILED");
    console.error("Error:", error.message);
    console.error("=================================");
  }
}

// ============================================================
// START SCHEDULER
// ============================================================

function startDailyReportScheduler() {
  // 12:10 AM India time, for the day that just ended
  cron.schedule(
    "10 0 * * *",

    async () => {
      await catchUpReports().catch((error) =>
        console.error("❌ Daily report failed:", error.message),
      );
    },

    {
      timezone: "Asia/Kolkata",
    },
  );

  // If the server was down at 12:10 AM, send the missed reports now
  // (nothing to do without email settings)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    catchUpReports().catch((error) =>
      console.error("❌ Daily report catch-up failed:", error.message),
    );
  }

  console.log("=================================");
  console.log("⏰ Daily Report Scheduler Started");
  console.log("📅 Every day 12:10 AM (Asia/Kolkata), for the previous day");
  console.log("=================================");
}

// ============================================================
// EXPORT

// ============================================================

module.exports = {
  startDailyReportScheduler,
  sendDailyReport,
};
