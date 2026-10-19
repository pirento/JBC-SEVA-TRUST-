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

  await create({ ...data, referenceRegistrationNumber: referenceNumber });

  const pdfData = {
    ...data,
    referenceRegistrationNumber: referenceNumber,
    submissionDate: new Date(),
  };

  const pdfBuffer = await generateMedicalReceipt(pdfData);
  await fs.mkdir(receiptsDir, { recursive: true });

  const fileName = `Medical-Help-Receipt-${referenceNumber}.pdf`;
  const filePath = path.join(receiptsDir, fileName);
  await fs.writeFile(filePath, pdfBuffer);

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

async function getMedicalReceipt(fileName) {
  const safeName = path.basename(fileName);
  const filePath = path.join(receiptsDir, safeName);
  await fs.access(filePath);
  return { filePath, fileName: safeName };
}

module.exports = { submitMedical, getMedicalReceipt };
