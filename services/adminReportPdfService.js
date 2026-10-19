const PDFDocument = require("pdfkit");

/**
 * Generate Daily Admin Report PDF
 *
 * @param {Object} report
 * @returns {Promise<Buffer>}
 */
async function generateDailyReportPdf(report) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });

      const chunks = [];

      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", reject);

      // ========================================
      // REPORT DATA
      // ========================================

      const summary = report?.summary || {};

      const memberships = Array.isArray(report?.memberships) ? report.memberships : [];

      const donations = Array.isArray(report?.donations) ? report.donations : [];

      const medicalRecords = Array.isArray(report?.medicalRecords)
        ? report.medicalRecords
        : [];

      // ========================================
      // HELPER FUNCTIONS
      // ========================================

      function safe(value) {
        return String(
          value === undefined || value === null || value === "" ? "-" : value,
        );
      }

      function money(value) {
        return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }

      function addLine(y) {
        doc.moveTo(40, y).lineTo(555, y).stroke();
      }

      function addPageHeader() {
        doc.fontSize(17).font("Helvetica-Bold").text("JBC SEVA TRUST", {
          align: "center",
        });

        doc
          .moveDown(0.3)
          .fontSize(11)
          .font("Helvetica")
          .text("Daily Administrative Report", {
            align: "center",
          });

        doc.moveDown(0.4);

        doc.fontSize(10).text(`Report Date: ${safe(report?.reportDate)}`, {
          align: "center",
        });

        doc.moveDown(0.3);

        doc
          .fontSize(8)
          .fillColor("#666666")
          .text(`Generated: ${new Date().toLocaleString("en-IN")}`, {
            align: "center",
          });

        doc.fillColor("#000000");

        doc.moveDown(1);

        addLine(doc.y);

        doc.moveDown(1);
      }

      function sectionTitle(title) {
        if (doc.y > 720) {
          doc.addPage();
          addPageHeader();
        }

        doc.fontSize(12).font("Helvetica-Bold").text(title);

        doc.moveDown(0.5);
      }

      function tableHeader(columns) {
        const y = doc.y;

        doc.fontSize(8).font("Helvetica-Bold");

        columns.forEach((column) => {
          doc.text(column.title, column.x, y, {
            width: column.width,
            align: column.align || "left",
          });
        });

        doc.moveDown(0.6);

        addLine(doc.y);
        doc.moveDown(0.5);
      }

      function checkSpace(requiredHeight = 60) {
        if (doc.y + requiredHeight > 760) {
          doc.addPage();
          addPageHeader();
        }
      }

      // ========================================
      // PAGE HEADER
      // ========================================

      addPageHeader();

      // ========================================
      // SUMMARY
      // ========================================

      sectionTitle("REPORT SUMMARY");

      const summaryRows = [
        ["Total Memberships", summary.membershipCount || 0],
        ["Membership Collection", money(summary.membershipCollection)],
        ["Total Donations", summary.donationCount || 0],
        ["Donation Collection", money(summary.donationCollection)],
        ["Medical Requests", summary.medicalCount || 0],
        ["TOTAL COLLECTION", money(summary.totalCollection)],
      ];

      summaryRows.forEach(([label, value]) => {
        checkSpace(25);

        const y = doc.y;

        doc
          .fontSize(9)
          .font(label === "TOTAL COLLECTION" ? "Helvetica-Bold" : "Helvetica")
          .text(label, 45, y, {
            width: 300,
          });

        doc
          .fontSize(9)
          .font(label === "TOTAL COLLECTION" ? "Helvetica-Bold" : "Helvetica")
          .text(safe(value), 360, y, {
            width: 180,
            align: "right",
          });

        doc.moveDown(0.7);
      });

      doc.moveDown(0.5);

      // ========================================
      // MEMBERSHIPS
      // ========================================

      if (memberships.length > 0) {
        doc.addPage();

        addPageHeader();

        sectionTitle(`MEMBERSHIPS (${memberships.length})`);

        tableHeader([
          {
            title: "Member",
            x: 40,
            width: 100,
          },
          {
            title: "Type",
            x: 145,
            width: 80,
          },
          {
            title: "Amount",
            x: 230,
            width: 60,
            align: "right",
          },
          {
            title: "Mode",
            x: 295,
            width: 55,
          },
          {
            title: "Date",
            x: 355,
            width: 70,
          },
          {
            title: "Transaction ID",
            x: 430,
            width: 120,
          },
        ]);

        memberships.forEach((item) => {
          checkSpace(45);

          const y = doc.y;

          doc.fontSize(7).font("Helvetica").text(safe(item.memberName), 40, y, {
            width: 100,
          });

          doc.text(safe(item.membershipType), 145, y, {
            width: 80,
          });

          doc.text(money(item.amount), 230, y, {
            width: 60,
            align: "right",
          });

          doc.text(safe(item.paymentMode), 295, y, {
            width: 55,
          });

          doc.text(`${safe(item.date)}\n${safe(item.time)}`, 355, y, {
            width: 70,
          });

          doc.text(safe(item.transactionId), 430, y, {
            width: 120,
          });

          doc.moveDown(1.8);

          addLine(doc.y);

          doc.moveDown(0.5);
        });
      }

      // ========================================
      // DONATIONS
      // ========================================

      if (donations.length > 0) {
        doc.addPage();

        addPageHeader();

        sectionTitle(`DONATIONS (${donations.length})`);

        tableHeader([
          {
            title: "Donor",
            x: 40,
            width: 100,
          },
          {
            title: "Amount",
            x: 145,
            width: 65,
            align: "right",
          },
          {
            title: "Mode",
            x: 215,
            width: 60,
          },
          {
            title: "Date",
            x: 280,
            width: 75,
          },
          {
            title: "Email",
            x: 360,
            width: 90,
          },
          {
            title: "Transaction ID",
            x: 455,
            width: 100,
          },
        ]);

        donations.forEach((item) => {
          checkSpace(50);

          const y = doc.y;

          doc.fontSize(7).font("Helvetica").text(safe(item.donorName), 40, y, {
            width: 100,
          });

          doc.text(money(item.amount), 145, y, {
            width: 65,
            align: "right",
          });

          doc.text(safe(item.paymentMode), 215, y, {
            width: 60,
          });

          doc.text(`${safe(item.date)}\n${safe(item.time)}`, 280, y, {
            width: 75,
          });

          doc.text(safe(item.email), 360, y, {
            width: 90,
          });

          doc.text(safe(item.transactionId), 455, y, {
            width: 100,
          });

          doc.moveDown(1.8);

          addLine(doc.y);

          doc.moveDown(0.5);
        });
      }

      // ========================================
      // MEDICAL REQUESTS
      // ========================================

      if (medicalRecords.length > 0) {
        doc.addPage();

        addPageHeader();

        sectionTitle(`MEDICAL HELP REQUESTS (${medicalRecords.length})`);

        tableHeader([
          {
            title: "Patient",
            x: 40,
            width: 90,
          },
          {
            title: "Disease",
            x: 135,
            width: 100,
          },
          {
            title: "Hospital",
            x: 240,
            width: 100,
          },
          {
            title: "Phone",
            x: 345,
            width: 65,
          },
          {
            title: "Reference",
            x: 415,
            width: 75,
          },
          {
            title: "Date",
            x: 495,
            width: 60,
          },
        ]);

        medicalRecords.forEach((item) => {
          checkSpace(55);

          const y = doc.y;

          doc.fontSize(7).font("Helvetica").text(safe(item.patientName), 40, y, {
            width: 90,
          });

          doc.text(safe(item.nameDiseases), 135, y, {
            width: 100,
          });

          doc.text(safe(item.hospitalName), 240, y, {
            width: 100,
          });

          doc.text(safe(item.patientPhoneNumber), 345, y, {
            width: 65,
          });

          doc.text(safe(item.referenceRegistrationNumber), 415, y, {
            width: 75,
          });

          doc.text(`${safe(item.date)}\n${safe(item.time)}`, 495, y, {
            width: 60,
          });

          doc.moveDown(1.8);

          addLine(doc.y);

          doc.moveDown(0.5);
        });
      }

      // ========================================
      // NO DATA
      // ========================================

      if (
        memberships.length === 0 &&
        donations.length === 0 &&
        medicalRecords.length === 0
      ) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text("No records found for the selected date.", {
            align: "center",
          });
      }

      // ========================================
      // FOOTER ON ALL PAGES
      // ========================================

      const range = doc.bufferedPageRange();

      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);

        doc
          .fontSize(7)
          .font("Helvetica")
          .fillColor("#666666")
          .text(
            `JBC Seva Trust | Daily Report | Page ${i + 1} of ${range.count}`,
            40,
            805,
            {
              width: 515,
              align: "center",
            },
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateDailyReportPdf,
};
