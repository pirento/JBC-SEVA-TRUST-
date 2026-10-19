const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { create } = require("../models/medicalModel");
const { sendEmail } = require("./emailService");
const { generateMedicalReceipt } = require("./medicalReceiptService");
const { dataDir } = require("../config/appConfig");
const escapeHtml = require("../utils/escapeHtml");

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
  const { patientName, dateBirth, patientEmail, nameDiseases, hospitalName } = data;
  await sendEmail({
    to: patientEmail,
    replyTo: patientEmail,
    subject: "Medical Help Request Received - JBC Seva Trust",
    text: `Hello ${patientName},\n\nThank you for contacting JBC Seva Trust.\n\nYour medical help request has been successfully received.\n\nReference Number:\n${referenceNumber}\n\nPatient Name:\n${patientName}\n\nDate of Birth:\n${dateBirth}\n\nPhone Number:\n${data.patientPhoneNumber}\n\nDisease:\n${nameDiseases}\n\nHospital:\n${hospitalName}\n\nYour official medical help receipt is attached to this email as a PDF.\n\nOur team will review your request and contact you soon.\n\nRegards,\nJBC Seva Trust`,
    html: `<div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;padding:30px;background:#ffffff;border:1px solid #dddddd;border-radius:10px"><h2 style="color:#14365d">JBC Seva Trust</h2><h3>Medical Help Request Received</h3><p>Hello <strong>${escapeHtml(patientName)}</strong>,</p><p>Thank you for contacting <strong>JBC Seva Trust</strong>.</p><p>Your medical help request has been successfully received.</p><div style="background:#f5f5f5;padding:15px;border-radius:6px;margin:20px 0"><strong>Reference Number:</strong><br>${referenceNumber}</div><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Patient Name</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(patientName)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Disease</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(nameDiseases)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Hospital</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(hospitalName)}</td></tr></table><p>📎 Your official medical help receipt is attached to this email.</p><p>Our team will review your request and contact you soon.</p><p>Regards,<br><strong>JBC Seva Trust</strong></p></div>`,
    attachments: [{ filename: fileName, content: pdfBuffer, contentType: "application/pdf" }],
  });
}

async function getMedicalReceipt(fileName) {
  const safeName = path.basename(fileName);
  const filePath = path.join(receiptsDir, safeName);
  await fs.access(filePath);
  return { filePath, fileName: safeName };
}

module.exports = { submitMedical, getMedicalReceipt };
