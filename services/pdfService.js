const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ========================================
// LOGO PATH
// ========================================

const logoPath = path.join(
  __dirname,
  "..",
  "public",
  "images",
  "logo.jpeg"
);

// ========================================
// HINDI / DEVANAGARI FONT PATH
// ========================================

const devanagariFontPath = path.join(
  __dirname,
  "..",
  "public",
  "fonts",
  "NotoSansDevanagari-Regular.ttf"
);

// ========================================
// CHECK HINDI / DEVANAGARI TEXT
// ========================================

function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(
    String(text || "")
  );
}

// ========================================
// SET DYNAMIC TEXT FONT
// ========================================

function setDynamicTextFont(
  doc,
  value,
  fallbackFont = "Helvetica"
) {
  const text = String(value || "");

  // Hindi / Mixed Hindi + English
  if (
    hasDevanagari(text) &&
    fs.existsSync(devanagariFontPath)
  ) {
    try {
      doc.font(devanagariFontPath);
      return;
    } catch (error) {
      console.error(
        "⚠️ Devanagari font loading failed:",
        error.message
      );
    }
  }

  // Normal English
  doc.font(fallbackFont);
}

// ========================================
// MASK AADHAR NUMBER
// ========================================

function maskAadhar(aadharNumber) {
  const value = String(
    aadharNumber || ""
  ).replace(/\D/g, "");

  if (value.length !== 12) {
    return "Not Available";
  }

  return `XXXX-XXXX-${value.slice(-4)}`;
}

// ========================================
// ESCAPE / SAFE TEXT
// ========================================

function safe(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not Provided";
  }

  return String(value);
}

// ========================================
// GENERATE MEDICAL RECEIPT PDF
// ========================================

function generateMedicalReceipt(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",

        margins: {
          top: 45,
          bottom: 45,
          left: 50,
          right: 50,
        },

        info: {
          Title:
            "Medical Help Request Receipt",

          Author:
            "JBC Seva Trust",

          Subject:
            "Medical Help Request",
        },
      });

      // ========================================
      // PDF BUFFER
      // ========================================

      const chunks = [];

      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(
          Buffer.concat(chunks)
        );
      });

      doc.on("error", (error) => {
        reject(error);
      });

      // ========================================
      // PAGE HEADER
      // ========================================

      if (fs.existsSync(logoPath)) {
        doc.image(
          logoPath,
          50,
          40,
          {
            fit: [75, 75],
          }
        );
      }

      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(
          "JBC SEVA TRUST",
          135,
          48,
          {
            width: 400,
          }
        );

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          "Medical Help & Social Welfare",
          135,
          73
        );

      // ========================================
      // HEADER LINE
      // ========================================

      doc
        .moveTo(50, 125)
        .lineTo(545, 125)
        .lineWidth(1)
        .stroke();

      // ========================================
      // TITLE
      // ========================================

      doc
        .moveDown(2)
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(
          "MEDICAL HELP REQUEST RECEIPT",
          {
            align: "center",
          }
        );

      doc
        .moveDown(0.5)
        .fontSize(10)
        .font("Helvetica")
        .text(
          "This receipt confirms that your medical help request has been received.",
          {
            align: "center",
          }
        );

      // ========================================
      // REFERENCE INFORMATION
      // ========================================

      doc.moveDown(1.5);

      const referenceNumber =
        safe(
          data.referenceRegistrationNumber
        );

      const submissionDate =
        data.submissionDate
          ? new Date(
              data.submissionDate
            ).toLocaleString("en-IN")
          : new Date().toLocaleString(
              "en-IN"
            );

      drawInfoBox(
        doc,
        "Reference Number",
        referenceNumber
      );

      drawInfoBox(
        doc,
        "Submission Date",
        submissionDate
      );

      // ========================================
      // PATIENT DETAILS
      // ========================================

      drawSectionTitle(
        doc,
        "PATIENT DETAILS"
      );

      drawTwoColumn(
        doc,
        "Patient Name",
        safe(data.patientName),

        "Aadhar Number",
        maskAadhar(
          data.aadharNumber
        )
      );

      drawTwoColumn(
        doc,
        "Date of Birth",
        safe(data.dateBirth),

        "Reference Name",
        safe(
          data.patientReferenceName
        )
      );

      drawTwoColumn(
        doc,
        "Phone Number",
        safe(
          data.patientPhoneNumber
        ),

        "Email",
        safe(data.patientEmail)
      );

      // ========================================
      // MEDICAL DETAILS
      // ========================================

      drawSectionTitle(
        doc,
        "MEDICAL DETAILS"
      );

      drawTwoColumn(
        doc,
        "Disease",
        safe(data.nameDiseases),

        "Hospital",
        safe(data.hospitalName)
      );

      // ========================================
      // IMPORTANT NOTE
      // ========================================

      doc.moveDown(1.5);

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Important Note");

      doc
        .moveDown(0.3)
        .fontSize(9.5)
        .font("Helvetica")
        .text(
          "This receipt only confirms submission of the medical help request. " +
            "Approval or financial assistance is subject to verification " +
            "and the Trust's applicable process."
        );

      // ========================================
      // FOOTER
      // ========================================

      const footerY =
        doc.page.height - 90;

      doc
        .moveTo(
          50,
          footerY - 15
        )
        .lineTo(
          545,
          footerY - 15
        )
        .lineWidth(0.5)
        .stroke();

      doc
        .fontSize(9)
        .font("Helvetica")
        .text(
          "JBC Seva Trust",
          50,
          footerY,
          {
            align: "center",
            width: 495,
          }
        );

      doc
        .fontSize(8)
        .font("Helvetica")
        .text(
          "Thank you for contacting JBC Seva Trust.",
          50,
          footerY + 16,
          {
            align: "center",
            width: 495,
          }
        );

      // ========================================
      // FINALIZE PDF
      // ========================================

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

// ========================================
// SECTION TITLE
// ========================================

function drawSectionTitle(
  doc,
  title
) {
  doc.moveDown(1.2);

  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(title);

  doc
    .moveDown(0.3)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .lineWidth(0.5)
    .stroke();

  doc.moveDown(0.5);
}

// ========================================
// TWO COLUMN ROW
// ========================================

function drawTwoColumn(
  doc,
  label1,
  value1,
  label2,
  value2
) {
  const leftX = 50;
  const rightX = 300;

  const startY = doc.y;

  // ======================================
  // LEFT LABEL
  // ======================================

  doc
    .fontSize(8.5)
    .font("Helvetica-Bold")
    .text(
      label1,
      leftX,
      startY,
      {
        width: 220,
      }
    );

  // ======================================
  // LEFT VALUE
  // ======================================

  setDynamicTextFont(
    doc,
    value1,
    "Helvetica"
  );

  doc
    .fontSize(10)
    .text(
      value1,
      leftX,
      startY + 14,
      {
        width: 220,
      }
    );

  // ======================================
  // RIGHT LABEL
  // ======================================

  doc
    .fontSize(8.5)
    .font("Helvetica-Bold")
    .text(
      label2,
      rightX,
      startY,
      {
        width: 220,
      }
    );

  // ======================================
  // RIGHT VALUE
  // ======================================

  setDynamicTextFont(
    doc,
    value2,
    "Helvetica"
  );

  doc
    .fontSize(10)
    .text(
      value2,
      rightX,
      startY + 14,
      {
        width: 220,
      }
    );

  doc.y =
    startY + 40;
}

// ========================================
// INFORMATION BOX
// ========================================

function drawInfoBox(
  doc,
  label,
  value
) {
  const y = doc.y;

  doc
    .roundedRect(
      50,
      y,
      495,
      42,
      5
    )
    .lineWidth(0.5)
    .stroke();

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .text(
      label,
      65,
      y + 8
    );

  // ======================================
  // DYNAMIC VALUE
  // ======================================

  setDynamicTextFont(
    doc,
    value,
    "Helvetica"
  );

  doc
    .fontSize(10)
    .text(
      value,
      65,
      y + 21
    );

  doc.y =
    y + 55;
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  generateMedicalReceipt,
};