const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const trust = require("../config/trustConfig");

// ============================================================
// SHARED CERTIFICATE DESIGN (donation + membership)
// ============================================================
//
// A4 landscape. Navy side panel with the logo on the left,
// the certificate on the right, in the logo's navy and saffron.
// ============================================================

const logoPath = path.join(__dirname, "..", "public", "images", "logo-mark.png");

const devanagariFontPath = path.join(__dirname, "..", "public", "fonts", "FreeSans.ttf");
// Bold, for a donor name in Hindi (English names use Times bold italic)
const devanagariBoldPath = path.join(
  __dirname,
  "..",
  "public",
  "fonts",
  "FreeSansBold.ttf",
);

const PAGE = { width: 841.89, height: 595.28 };

const COLORS = {
  navy: "#15375c",
  navyDark: "#0c2340",
  saffron: "#d97706",
  saffronLight: "#dd870d",
  paper: "#fffdf8",
  cream: "#faf3e3",
  text: "#1d2733",
  muted: "#5b6676",
  line: "#e6dcc8",
};

// ============================================================
// HELPERS
// ============================================================

function safe(value, fallback = "Not Provided") {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  return String(value).trim();
}

// ============================================================
// TRUNCATE
// ============================================================

function truncate(value, maxLength) {
  const text = safe(value, "");

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + "...";
}

// ============================================================
// DEVANAGARI CHECK
// ============================================================

function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(String(text || ""));
}

// ============================================================
// DONOR NAME FONT
// ============================================================

function setDonorNameFont(doc, value) {
  const text = String(value || "");

  if (hasDevanagari(text) && fs.existsSync(devanagariBoldPath)) {
    try {
      doc.font(devanagariBoldPath);
      return;
    } catch (error) {
      console.error("⚠️ Devanagari font loading failed:", error.message);
    }
  }

  doc.font("Times-BoldItalic");
}

// ============================================================
// DATE
// ============================================================

function getDate(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function formatDate(value) {
  return getDate(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ============================================================
// AMOUNT
// ============================================================

function formatAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ============================================================
// NUMBER TO WORDS
// ============================================================

function numberToWordsIndian(number) {
  const num = Math.floor(Number(number));

  if (!Number.isFinite(num) || num <= 0) {
    return "Zero Rupees Only";
  }

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function twoDigits(n) {
    if (n < 20) {
      return ones[n];
    }

    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function convert(n) {
    let result = "";

    if (n >= 10000000) {
      result += convert(Math.floor(n / 10000000)) + " Crore ";

      n %= 10000000;
    }

    if (n >= 100000) {
      result += convert(Math.floor(n / 100000)) + " Lakh ";

      n %= 100000;
    }

    if (n >= 1000) {
      result += convert(Math.floor(n / 1000)) + " Thousand ";

      n %= 1000;
    }

    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + " Hundred ";

      n %= 100;
    }

    if (n > 0) {
      if (result.trim()) {
        result += "and ";
      }

      result += twoDigits(n);
    }

    return result.trim();
  }

  return `${convert(num)} Rupees Only`;
}
// ============================================================
// DRAWING
// ============================================================

const PANEL = 232;
const CONTENT_X = PANEL + 46;
const CONTENT_W = PAGE.width - CONTENT_X - 46;

function drawFrame(doc) {
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.paper);

  // Side panel
  doc.rect(0, 0, PANEL, PAGE.height).fill(COLORS.navy);
  doc.rect(PANEL, 0, 5, PAGE.height).fill(COLORS.saffronLight);

  // Thin saffron frame around the content side
  doc
    .rect(PANEL + 18, 18, PAGE.width - PANEL - 36, PAGE.height - 36)
    .lineWidth(0.8)
    .stroke(COLORS.saffronLight);

  // Faint emblem watermark behind the text
  if (fs.existsSync(logoPath)) {
    doc.save();
    doc.opacity(0.035);
    doc.image(logoPath, CONTENT_X + CONTENT_W / 2 - 150, PAGE.height / 2 - 150, {
      width: 300,
    });
    doc.restore();
  }
}

function drawPanel(doc, { certificateNumber, issuedOn }) {
  const cx = PANEL / 2;

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, cx - 52, 56, { width: 104 });
  }

  doc
    .font("Times-Bold")
    .fontSize(34)
    .fillColor("#ffffff")
    .text("JBC", 0, 176, { width: PANEL, align: "center", characterSpacing: 1 });

  doc
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(COLORS.saffronLight)
    .text("SEVA TRUST", 0, 214, { width: PANEL, align: "center", characterSpacing: 3 });

  doc
    .moveTo(cx - 40, 242)
    .lineTo(cx + 40, 242)
    .lineWidth(1)
    .stroke(COLORS.saffronLight);

  doc
    .font("Times-Italic")
    .fontSize(12)
    .fillColor("#dbe5f1")
    .text("Serving humanity.", 0, 256, { width: PANEL, align: "center" })
    .text("Preserving nature.", 0, 272, { width: PANEL, align: "center" });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#b9c8db")
    .text(trust.legalForm, 0, 314, { width: PANEL, align: "center" })
    .text(trust.location, 0, 327, { width: PANEL, align: "center" });

  // Certificate number and date at the bottom of the panel
  const label = (text, y) =>
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#93a6bd")
      .text(text, 24, y, { width: PANEL - 48, characterSpacing: 1 });
  const value = (text, y) =>
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#ffffff")
      .text(text, 24, y, { width: PANEL - 48 });

  label("CERTIFICATE NO.", 470);
  value(certificateNumber, 482);
  label("ISSUED ON", 508);
  value(issuedOn, 520);
}

function drawHeading(doc, { eyebrow, title }) {
  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(COLORS.saffron)
    .text(eyebrow.toUpperCase(), CONTENT_X, 50, {
      width: CONTENT_W,
      characterSpacing: 2.5,
    });

  doc
    .font("Times-Bold")
    .fontSize(38)
    .fillColor(COLORS.navy)
    .text(title, CONTENT_X, 66, { width: CONTENT_W });
}

function drawRecipient(doc, { lead, name, statement }) {
  doc
    .font("Times-Roman")
    .fontSize(13)
    .fillColor(COLORS.muted)
    .text(lead, CONTENT_X, 128, { width: CONTENT_W });

  // Long names shrink to fit one line instead of losing their second half
  setDonorNameFont(doc, name);
  const fullName = truncate(name, 100);
  let nameSize = 32;
  while (nameSize > 16 && doc.fontSize(nameSize).widthOfString(fullName) > CONTENT_W)
    nameSize -= 1;
  doc
    .fontSize(nameSize)
    .fillColor(COLORS.navy)
    .text(fullName, CONTENT_X, 148 + (32 - nameSize) / 2, {
      width: CONTENT_W,
      lineBreak: false,
      ellipsis: true,
    });

  doc
    .moveTo(CONTENT_X, 192)
    .lineTo(CONTENT_X + 260, 192)
    .lineWidth(1.5)
    .stroke(COLORS.saffronLight);

  // The statement may hold Hindi parts (a dedication typed in Hindi);
  // each part gets a font that has its letters
  const parts = [].concat(statement).filter(Boolean);
  doc.fontSize(12.5).fillColor(COLORS.text);
  parts.forEach((part, i) => {
    doc.font(
      hasDevanagari(part) && fs.existsSync(devanagariFontPath)
        ? devanagariFontPath
        : "Times-Roman",
    );
    const options = {
      width: CONTENT_W - 20,
      lineGap: 3,
      continued: i < parts.length - 1,
    };
    if (i === 0) doc.text(part, CONTENT_X, 206, options);
    else doc.text(part, options);
  });
}

// Amount block on the left, detail rows in two columns on the right
function drawDetails(doc, { amount, amountWords, details }) {
  const top = 288;
  const boxW = 168;

  doc.roundedRect(CONTENT_X, top, boxW, 112, 6).fill(COLORS.cream);
  doc.rect(CONTENT_X, top, 4, 112).fill(COLORS.saffronLight);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("AMOUNT", CONTENT_X + 16, top + 14, { characterSpacing: 1.5 });

  // Shrink large amounts so they stay on one line
  const amountText = `Rs. ${formatAmount(amount)}`;
  let size = 26;
  doc.font("Times-Bold");
  while (size > 14 && doc.fontSize(size).widthOfString(amountText) > boxW - 28) size -= 1;

  doc
    .fontSize(size)
    .fillColor(COLORS.navy)
    .text(amountText, CONTENT_X + 16, top + 28 + (26 - size) / 2, {
      width: boxW - 24,
      lineBreak: false,
    });

  doc
    .font("Times-Italic")
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(amountWords, CONTENT_X + 16, top + 64, { width: boxW - 28, height: 40 });

  const gridX = CONTENT_X + boxW + 24;
  const colW = (CONTENT_W - boxW - 24) / 2;
  const rows = details.filter(([, v]) => v);

  rows.forEach(([label, value], i) => {
    const x = gridX + (i % 2) * colW;
    const y = top + Math.floor(i / 2) * 30;

    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(label.toUpperCase(), x, y, { width: colW - 12, characterSpacing: 1 });

    // Shrink long values to one line; a value that still does not fit
    // (a 42-character transaction ID) wraps to a second line, so callers
    // list it last where nothing sits below it
    const text = String(value);
    let size = 10;
    doc.font("Helvetica-Bold");
    while (size > 7.5 && doc.fontSize(size).widthOfString(text) > colW - 12) size -= 0.5;
    doc.fillColor(COLORS.text).text(text, x, y + 11, { width: colW - 12 });
  });
}

function drawFooter(doc, { note }) {
  const y = 470;

  // Signature line (no printed signature; a trustee signs or stamps a printout)
  doc
    .moveTo(PAGE.width - 46 - 190, y + 28)
    .lineTo(PAGE.width - 46, y + 28)
    .lineWidth(0.8)
    .stroke(COLORS.navy);

  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(COLORS.navy)
    .text(`For ${trust.name}`, PAGE.width - 46 - 190, y + 34, {
      width: 190,
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("Authorised Trustee", PAGE.width - 46 - 190, y + 47, {
      width: 190,
      align: "center",
    });

  doc
    .font("Times-Italic")
    .fontSize(13)
    .fillColor(COLORS.navy)
    .text("With gratitude,", CONTENT_X, y + 14)
    .font("Times-Bold")
    .text(trust.name, CONTENT_X, y + 32);

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(note, CONTENT_X, PAGE.height - 50, { width: CONTENT_W, align: "left" });
}

// ============================================================
// RENDER
// ============================================================

/**
 * Builds a certificate PDF and resolves with its Buffer.
 * opts: { title, eyebrow, lead, name, statement, amount,
 *         details: [[label, value]], certificateNumber, date, note, docTitle }
 */
function renderCertificatePdf(opts) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 0,
        info: {
          Title: `${opts.docTitle} - ${trust.name}`,
          Author: trust.name,
          Subject: opts.docTitle,
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawFrame(doc);
      drawPanel(doc, {
        certificateNumber: opts.certificateNumber,
        issuedOn: formatDate(opts.date),
      });
      drawHeading(doc, opts);
      drawRecipient(doc, opts);
      drawDetails(doc, {
        amount: opts.amount,
        amountWords: numberToWordsIndian(Number(opts.amount) || 0),
        details: opts.details,
      });
      drawFooter(doc, opts);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  renderCertificatePdf,
  safe,
  formatDate,
  getDate,
};
