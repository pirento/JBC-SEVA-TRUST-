const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const trust = require("../config/trustConfig");

// ============================================================
// YEARLY STATEMENT (donor's account page)
// ============================================================
//
// One A4 page (more if needed) listing every donation and membership
// paid with the account's email in one financial year (April-March).
// A summary for the donor's records, not a tax receipt: the receipts
// themselves stay downloadable one by one.
// ============================================================

const logoPath = path.join(__dirname, "..", "public", "images", "logo-mark.png");
// Has both Devanagari and Latin letters (see CLAUDE.md)
const fontPath = path.join(__dirname, "..", "public", "fonts", "FreeSans.ttf");
const boldPath = path.join(__dirname, "..", "public", "fonts", "FreeSansBold.ttf");

const NAVY = "#15375c";
const SAFFRON = "#dd870d";
const MUTED = "#5b6676";
const MARGIN = 48;
const WIDTH = 595.28 - MARGIN * 2;

const rupees = (n) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;

// Financial years the donor has payments in, newest first
function yearsWithPayments(activity) {
  const years = new Set(
    [...activity.donations, ...activity.memberships]
      .map((item) => item.financialYear)
      .filter(Boolean),
  );
  return [...years].sort().reverse();
}

// Rows of one financial year, oldest first
function rowsFor(activity, fy) {
  return [
    ...activity.donations.map((d) => ({
      ...d,
      what: d.cause || trust.GENERAL_CAUSE,
      detail: d.purpose,
    })),
    ...activity.memberships.map((m) => ({
      ...m,
      what: "Membership",
      detail: m.membershipType,
    })),
  ]
    .filter((item) => item.financialYear === fy)
    .sort((a, b) => a.time - b.time);
}

function generateStatement({ name, email, fy, rows }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: { Title: `Statement ${fy}`, Author: trust.name },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("body", fontPath);
    doc.registerFont("bold", boldPath);

    // Header band
    doc.rect(0, 0, 595.28, 96).fill(NAVY);
    doc.rect(0, 96, 595.28, 4).fill(SAFFRON);
    if (fs.existsSync(logoPath)) doc.image(logoPath, MARGIN, 20, { width: 56 });
    doc
      .font("bold")
      .fontSize(18)
      .fillColor("#ffffff")
      .text(trust.name, MARGIN + 70, 30);
    doc
      .font("body")
      .fontSize(10)
      .fillColor("#ffffff")
      .text(`Statement of payments · Financial year ${fy}`, MARGIN + 70, 56);

    doc.y = 124;
    doc
      .font("bold")
      .fontSize(12)
      .fillColor(NAVY)
      .text(name || email, MARGIN);
    doc.font("body").fontSize(9.5).fillColor(MUTED).text(email);
    doc.moveDown(1);

    // Table
    const cols = [
      ["Date", 0, 80],
      ["For", 80, 200],
      ["Transaction", 280, 140],
      ["Amount", 420, WIDTH - 420],
    ];
    const header = () => {
      const y = doc.y;
      doc.font("bold").fontSize(9).fillColor(NAVY);
      cols.forEach(([label, x, w]) =>
        doc.text(label, MARGIN + x, y, {
          width: w,
          align: label === "Amount" ? "right" : "left",
        }),
      );
      doc
        .moveTo(MARGIN, y + 14)
        .lineTo(MARGIN + WIDTH, y + 14)
        .lineWidth(1)
        .stroke(SAFFRON);
      doc.y = y + 20;
    };
    header();

    let total = 0;
    for (const row of rows) {
      if (doc.y > 760) {
        doc.addPage();
        header();
      }
      const y = doc.y;
      doc.font("body").fontSize(9).fillColor("#1d2733");
      doc.text(row.date, MARGIN, y, { width: 80 });
      doc.text(row.what + (row.detail ? `\n${row.detail}` : ""), MARGIN + 80, y, {
        width: 195,
      });
      const bottom = doc.y;
      doc.text(row.transactionId, MARGIN + 280, y, { width: 135 });
      doc.text(rupees(row.amount), MARGIN + 420, y, {
        width: WIDTH - 420,
        align: "right",
      });
      doc.y = Math.max(bottom, doc.y) + 6;
      total += Number(row.amount || 0);
    }

    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + WIDTH, doc.y)
      .lineWidth(0.5)
      .stroke(MUTED);
    doc.y += 8;
    doc.font("bold").fontSize(10.5).fillColor(NAVY);
    doc.text(`Total: ${rupees(total)}`, MARGIN, doc.y, { width: WIDTH, align: "right" });
    doc.moveDown(2);

    doc
      .font("body")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        "This statement is a summary for your records and is not a receipt. " +
          "Each receipt can be downloaded from My Account on the website. " +
          `Questions: ${trust.email} · ${trust.phoneDisplay}`,
        MARGIN,
        doc.y,
        { width: WIDTH },
      );

    doc.end();
  });
}

module.exports = { generateStatement, yearsWithPayments, rowsFor };
