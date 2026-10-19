const fs = require("fs");
const path = require("path");

const { renderCertificatePdf, safe, formatDate } = require("./certificateDesign");
const { taxNote, eightyG, GENERAL_CAUSE } = require("../config/trustConfig");
const { dataDir } = require("../config/appConfig");

// ============================================================
// CERTIFICATE NUMBER
// ============================================================

function generateCertificateNumber(data) {
  if (data.certificateNumber) return safe(data.certificateNumber);
  if (data.receiptNumber) return safe(data.receiptNumber);

  const cleanId = safe(data.txnid || data.transactionId, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10);

  return cleanId ? `JBCD${cleanId.toUpperCase()}` : `JBCD${Date.now()}`;
}

// ============================================================
// GENERATE + SAVE DONATION CERTIFICATE
// ============================================================

async function generateDonationCertificate(data) {
  const cause = safe(data.cause, GENERAL_CAUSE);
  const purpose = String(data.purpose || "").trim();
  const certificateNumber = generateCertificateNumber(data);

  const pdfBuffer = await renderCertificatePdf({
    docTitle: "Donation Certificate",
    eyebrow: "Certificate of Appreciation",
    title: "Donation Certificate",
    lead: "This certificate is gratefully presented to",
    name: safe(data.donorName, "Donor"),
    statement:
      `for a generous contribution to ${cause}` +
      (purpose && purpose !== "General donation" ? ` (${purpose})` : "") +
      (data.dedicatedTo
        ? `, ${String(data.dedicationType).toLowerCase()} ${data.dedicatedTo}`
        : "") +
      ". Your support helps us serve people and protect nature in our villages.",
    amount: data.amount,
    certificateNumber,
    date: data.paymentDate,
    details: [
      ["Fund", cause],
      ["Purpose", purpose],
      ["Payment Mode", safe(data.paymentMode, "Online")],
      ["Transaction ID", safe(data.txnid || data.transactionId, "N/A")],
      ["Payment ID", safe(data.mihpayid || data.payuPaymentId, "")],
      ["Seva Date", data.sevaDate ? formatDate(data.sevaDate) : ""],
      // Donor PAN is needed on an 80G receipt; shown only once approved
      ["Donor PAN", eightyG.approved ? data.pan : ""],
    ],
    note: taxNote(cause) + " This is a computer-generated certificate.",
  });

  const receiptsDir = path.join(dataDir, "receipts");
  fs.mkdirSync(receiptsDir, { recursive: true });

  const transactionId = String(data.txnid || data.transactionId || Date.now()).replace(
    /[^A-Za-z0-9_-]/g,
    "_",
  );
  const fileName = `donation-certificate-${transactionId}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  fs.writeFileSync(filePath, pdfBuffer);
  console.log("✅ Donation certificate generated:", fileName, certificateNumber);

  return {
    path: filePath,
    filePath,
    fileName,
    certificateNumber,
    buffer: pdfBuffer,
  };
}

module.exports = {
  generateDonationCertificate,
};
