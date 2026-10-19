const cron = require("node-cron");

const { getDailyReport } = require("./adminReportService");

const { generateDailyReportPdf } = require("./adminReportPdfService");

const { sendEmail } = require("./emailService");

const { appendRecord, readRecords } = require("../models/fileStore");

const { trustEmail: REPORT_EMAIL } = require("../config/emailConfig");

// ============================================================
// GET TODAY'S DATE IN INDIA
// ============================================================

function getIndiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

async function sendDailyReport() {
  const reportDate = getIndiaDate();

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

    await sendEmail({
      to: REPORT_EMAIL,

      subject: `JBC Seva Trust - Daily Report - ${reportDate}`,

      text: `Dear Admin,

Please find attached the daily administrative report for ${reportDate}.

Memberships: ${report.summary.membershipCount}
Membership Collection: Rs. ${report.summary.membershipCollection}

Donations: ${report.summary.donationCount}
Donation Collection: Rs. ${report.summary.donationCollection}

Medical Help Requests: ${report.summary.medicalCount}

Total Collection: Rs. ${report.summary.totalCollection}

This is an automatically generated report.

Regards,
JBC Seva Trust`,

      html: `
        <h2>JBC Seva Trust</h2>

        <h3>Daily Administrative Report</h3>

        <p>
          <strong>Report Date:</strong>
          ${reportDate}
        </p>

        <hr>

        <h3>Report Summary</h3>

        <p>
          <strong>Total Memberships:</strong>
          ${report.summary.membershipCount}
        </p>

        <p>
          <strong>Membership Collection:</strong>
          Rs. ${Number(report.summary.membershipCollection || 0).toLocaleString("en-IN")}
        </p>

        <p>
          <strong>Total Donations:</strong>
          ${report.summary.donationCount}
        </p>

        <p>
          <strong>Donation Collection:</strong>
          Rs. ${Number(report.summary.donationCollection || 0).toLocaleString("en-IN")}
        </p>

        <p>
          <strong>Medical Help Requests:</strong>
          ${report.summary.medicalCount}
        </p>

        <p>
          <strong>Total Collection:</strong>
          Rs. ${Number(report.summary.totalCollection || 0).toLocaleString("en-IN")}
        </p>

        <hr>

        <p>
          The complete detailed report is attached as a PDF.
        </p>

        <p>
          This is an automatically generated email.
        </p>

        <p>
          Regards,<br>
          <strong>JBC Seva Trust</strong>
        </p>
      `,

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
    console.log("📧 To:", REPORT_EMAIL);
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
  cron.schedule(
    "59 23 * * *",

    async () => {
      await sendDailyReport();
    },

    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log("=================================");
  console.log("⏰ Daily Report Scheduler Started");
  console.log("📅 Every day");
  console.log("🕚 11:59 PM");
  console.log("🇮🇳 Timezone: Asia/Kolkata");
  console.log("📧 Recipient:", REPORT_EMAIL);
  console.log("=================================");
}

// ============================================================
// EXPORT

// ============================================================

module.exports = {
  startDailyReportScheduler,
  sendDailyReport,
};
