const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const trust = require("../config/trustConfig");

// ========================================
// MEDICAL HELP REQUEST RECEIPT
// ========================================
//
// A4 portrait in the trust's look: navy band with the logo, saffron
// accents, the reference number up front, the request in two columns,
// and what happens next. Aadhaar is never printed in full.
// ========================================

const logoPath = path.join(__dirname, "..", "public", "images", "logo-mark.png");
// Has both Devanagari and Latin letters (see CLAUDE.md for why not Noto)
const hindiFontPath = path.join(__dirname, "..", "public", "fonts", "FreeSansBold.ttf");

const COLORS = {
  navy: "#15375c",
  saffron: "#d97706",
  saffronLight: "#dd870d",
  cream: "#faf3e3",
  text: "#1d2733",
  muted: "#5b6676",
  line: "#e6dcc8",
};

const PAGE_W = 595.28;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hasDevanagari(text) {
  return /[ऀ-ॿ]/.test(String(text || ""));
}

// Hindi text gets a font that has its letters
function setValueFont(doc, value, fallback = "Helvetica-Bold") {
  doc.font(
    hasDevanagari(value) && fs.existsSync(hindiFontPath) ? hindiFontPath : fallback,
  );
}

function maskAadhar(aadharNumber) {
  const value = String(aadharNumber || "").replace(/\D/g, "");
  return value.length === 12 ? `XXXX-XXXX-${value.slice(-4)}` : "Not available";
}

function safe(value) {
  return value === null || value === undefined || value === ""
    ? "Not provided"
    : String(value);
}

function formatDateTime(value) {
  const date = new Date(value || Date.now());
  return (Number.isNaN(date.getTime()) ? new Date() : date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ========================================
// DRAWING
// ========================================

function drawHeader(doc) {
  doc.rect(0, 0, PAGE_W, 112).fill(COLORS.navy);
  doc.rect(0, 112, PAGE_W, 4).fill(COLORS.saffronLight);

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, MARGIN, 26, { width: 60, height: 60 });
  }

  doc
    .font("Times-Bold")
    .fontSize(26)
    .fillColor("#ffffff")
    .text("JBC", MARGIN + 74, 34);
  doc
    .font("Times-Bold")
    .fontSize(10)
    .fillColor(COLORS.saffronLight)
    .text("SEVA TRUST", MARGIN + 75, 64, { characterSpacing: 3 });

  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(COLORS.saffronLight)
    .text("MEDICAL HELP REQUEST", MARGIN, 40, {
      width: CONTENT_W,
      align: "right",
      characterSpacing: 2,
    });
  doc
    .font("Times-Bold")
    .fontSize(24)
    .fillColor("#ffffff")
    .text("Receipt", MARGIN, 54, { width: CONTENT_W, align: "right" });
}

function drawReference(doc, reference, submitted) {
  const y = 140;
  doc.roundedRect(MARGIN, y, CONTENT_W, 62, 6).fill(COLORS.cream);
  doc.rect(MARGIN, y, 4, 62).fill(COLORS.saffronLight);

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text("REFERENCE NUMBER", MARGIN + 18, y + 13, { characterSpacing: 1.5 });
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(COLORS.navy)
    .text(reference, MARGIN + 18, y + 28, { width: 300, lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text("SUBMITTED ON", MARGIN + 330, y + 13, { characterSpacing: 1.5 });
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(COLORS.text)
    .text(submitted, MARGIN + 330, y + 30, { width: CONTENT_W - 346 });

  doc.y = y + 84;
}

function drawSection(doc, title) {
  doc.font("Times-Bold").fontSize(14).fillColor(COLORS.navy).text(title, MARGIN, doc.y);
  doc
    .moveTo(MARGIN, doc.y + 4)
    .lineTo(MARGIN + CONTENT_W, doc.y + 4)
    .lineWidth(1)
    .stroke(COLORS.line);
  doc.y += 14;
}

// Label/value pairs in two columns; each row is as tall as its taller value
function drawFields(doc, pairs) {
  const colW = (CONTENT_W - 24) / 2;

  for (let i = 0; i < pairs.length; i += 2) {
    const top = doc.y;
    let bottom = top;

    pairs.slice(i, i + 2).forEach(([label, value], col) => {
      const x = MARGIN + col * (colW + 24);
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(label.toUpperCase(), x, top, { width: colW, characterSpacing: 1 });
      setValueFont(doc, value);
      doc
        .fontSize(10.5)
        .fillColor(COLORS.text)
        .text(safe(value), x, top + 12, { width: colW });
      bottom = Math.max(bottom, doc.y);
    });

    doc.y = bottom + 12;
  }
  doc.x = MARGIN;
  doc.y += 8;
}

function drawNextSteps(doc) {
  const steps = [
    "Our team will check the details and may call you or ask for hospital papers.",
    "The trustees decide on each request based on need and the funds available.",
    "Submitting a request does not guarantee help. Keep this reference number for any follow-up.",
  ];
  const y = doc.y + 4;
  const height = 96;

  doc.roundedRect(MARGIN, y, CONTENT_W, height, 6).fill(COLORS.cream);
  doc.rect(MARGIN, y, 4, height).fill(COLORS.saffronLight);
  doc
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(COLORS.navy)
    .text("What happens next", MARGIN + 18, y + 12);

  let lineY = y + 32;
  steps.forEach((step, i) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(COLORS.saffron)
      .text(`${i + 1}.`, MARGIN + 18, lineY);
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(COLORS.text)
      .text(step, MARGIN + 34, lineY, { width: CONTENT_W - 52 });
    lineY = doc.y + 4;
  });
}

function drawFooter(doc) {
  const y = 770;
  // The footer sits below the bottom margin; do not let pdfkit add a page
  doc.page.margins.bottom = 0;

  doc
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_W, y)
    .lineWidth(1)
    .stroke(COLORS.saffronLight);
  doc
    .font("Times-Bold")
    .fontSize(10)
    .fillColor(COLORS.navy)
    .text(trust.name, MARGIN, y + 10, { width: CONTENT_W, align: "center" });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      `${trust.legalForm} · ${trust.location} · ${trust.email} · ${trust.phoneDisplay}`,
      MARGIN,
      y + 25,
      { width: CONTENT_W, align: "center" },
    )
    .text(
      "This is a computer-generated receipt and needs no signature.",
      MARGIN,
      y + 37,
      {
        width: CONTENT_W,
        align: "center",
      },
    );
}

// ========================================
// GENERATE MEDICAL RECEIPT PDF
// ========================================

function generateMedicalReceipt(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: MARGIN,
        info: { Title: "Medical Help Request Receipt", Author: trust.name },
      });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawHeader(doc);
      drawReference(
        doc,
        safe(data.referenceRegistrationNumber),
        formatDateTime(data.submissionDate),
      );

      drawSection(doc, "Patient");
      drawFields(doc, [
        ["Patient name", data.patientName],
        ["Aadhaar", maskAadhar(data.aadharNumber)],
        ["Date of birth", data.dateBirth],
        ["Mobile number", data.patientPhoneNumber],
        ["Email", data.patientEmail],
        ["Referred by", data.patientReferenceName],
      ]);

      drawSection(doc, "Help asked for");
      drawFields(doc, [
        ["Illness", data.nameDiseases],
        ["Hospital", data.hospitalName],
      ]);

      drawNextSteps(doc);
      drawFooter(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateMedicalReceipt,
};
