const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { create } = require("../models/medicalModel");
const { sendEmail } = require("./emailService");
const { generateMedicalReceipt } = require("./medicalReceiptService");
const { dataDir } = require("../config/appConfig");
const { renderEmail } = require("./emailTemplate");

const receiptsDir = path.join(dataDir, "receipts");

async function submitMedical(data) {
  // Random suffix: receipts download by file name, so it must not be guessable
  const referenceNumber = `MED-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // The reference is shared with hospitals and printed everywhere, so
  // the download link carries its own secret key as well
  const fileName = `Medical-Help-Receipt-${referenceNumber}-${crypto.randomBytes(16).toString("hex")}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  // Receipt first, record second: if the PDF fails nothing is saved,
  // so the duplicate check does not block the patient's retry
  let pdfBuffer;
  try {
    pdfBuffer = await generateMedicalReceipt({
      ...data,
      referenceRegistrationNumber: referenceNumber,
      submissionDate: new Date(),
    });
    await fs.mkdir(receiptsDir, { recursive: true });
    await fs.writeFile(filePath, pdfBuffer);
  } catch (error) {
    console.error("❌ Medical receipt failed:", error.message);
    throw new Error(
      "We could not create your receipt. Please try again in a few minutes.",
    );
  }

  try {
    await create({
      ...data,
      referenceRegistrationNumber: referenceNumber,
      receiptFile: fileName,
    });
  } catch (error) {
    await fs.unlink(filePath).catch(() => {});
    throw error;
  }

  sendMedicalEmail(data, referenceNumber, fileName, pdfBuffer).catch((err) => {
    console.error("❌ Background email failed:", err.message);
  });

  return { reference: referenceNumber, file: fileName };
}

async function sendMedicalEmail(data, referenceNumber, fileName, pdfBuffer) {
  const lang = data.lang === "hi" ? "hi" : "en";
  const name = String(data.patientName || "").trim();

  const { html, text } = renderEmail({
    lang,
    preheader: `Reference number ${referenceNumber}`,
    heading: "Medical help request received",
    greeting: lang === "hi" ? `नमस्ते,` : `Hello,`,
    paragraphs: [
      "We have received the medical help request. Our team will review it and contact you. The receipt is attached to this email as a PDF.",
    ],
    rows: [
      ["Reference number", referenceNumber],
      ["Patient", name],
      ["Illness", data.nameDiseases],
      ["Hospital", data.hospitalName],
    ],
    note: "Submitting a request does not guarantee financial or medical help. Keep the reference number for any follow-up.",
  });

  await sendEmail({
    to: data.patientEmail,
    // Receipt: the trust keeps a hidden copy
    copyTrust: true,
    subject:
      lang === "hi"
        ? `चिकित्सा सहायता अनुरोध मिला (${referenceNumber}) - JBC Seva Trust`
        : `Medical help request received (${referenceNumber}) - JBC Seva Trust`,
    text,
    html,
    attachments: [
      { filename: fileName, content: pdfBuffer, contentType: "application/pdf" },
    ],
  });
}

// After the admin corrects a request: print the receipt again over the
// same file (the download link stays the same)
async function regenerateReceipt(record) {
  const fileName =
    record.receiptFile ||
    `Medical-Help-Receipt-${record.referenceRegistrationNumber}.pdf`;
  const pdfBuffer = await generateMedicalReceipt({
    ...record,
    submissionDate: record.submittedAt,
  });
  await fs.mkdir(receiptsDir, { recursive: true });
  await fs.writeFile(path.join(receiptsDir, path.basename(fileName)), pdfBuffer);
  return { fileName, pdfBuffer };
}

async function getMedicalReceipt(fileName) {
  const safeName = path.basename(fileName);
  const filePath = path.join(receiptsDir, safeName);
  await fs.access(filePath);
  return { filePath, fileName: safeName };
}

module.exports = {
  submitMedical,
  getMedicalReceipt,
  regenerateReceipt,
  sendMedicalEmail,
};
