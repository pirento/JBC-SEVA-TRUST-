const path = require("path");

const { sendEmail } = require("./emailService");
const { renderEmail, t } = require("./emailTemplate");
const { taxNote, donationPages } = require("../config/trustConfig");
const { appUrl } = require("../config/appConfig");

// ============================================================
// DONATION RECEIPT EMAIL (certificate attached)
// ============================================================

async function sendDonationCertificateEmail({ donation, certificatePath }) {
  if (!donation) {
    throw new Error("Donation data is required.");
  }

  const lang = donation.lang === "hi" ? "hi" : "en";
  const donorName = String(donation.donorName || "Donor").trim();
  const cause = donation.cause || "Where Most Needed";
  const amount = Number(donation.amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const transactionId = String(donation.transactionId || donation.txnid || "").trim();
  const page = donationPages.find((p) => p.title === cause);

  const { html, text } = renderEmail({
    lang,
    preheader: `Receipt for your donation of Rs. ${amount}`,
    heading: "Thank you for your donation",
    greeting: lang === "hi" ? `नमस्ते ${donorName},` : `Dear ${donorName},`,
    paragraphs: [
      certificatePath
        ? "We have received your donation. Your certificate is attached to this email as a PDF."
        : "We have received your donation. You can download your certificate with the button below.",
    ],
    rows: [
      ["Amount", `₹${amount}`],
      ["Donated for", t(cause, lang)],
      ["Purpose", t(donation.purpose, lang)],
      [
        "Dedication",
        // Hindi puts "in memory of" after the name
        !donation.dedicatedTo
          ? ""
          : lang === "hi"
            ? `${donation.dedicatedTo} ${t(donation.dedicationType, lang)}`
            : `${donation.dedicationType} ${donation.dedicatedTo}`,
      ],
      ["Preferred seva date", donation.sevaDate],
      ["Gotra", donation.gotra],
      ["Payment mode", donation.paymentMode],
      ["Transaction ID", transactionId],
    ],
    button: {
      label: "Download Certificate",
      url: `${appUrl}/donate/certificate/${encodeURIComponent(transactionId)}`,
    },
    note: taxNote(cause, donation.paymentDate),
    footerNote:
      page && page.donation.religious
        ? ""
        : "Money given for a cause is used only for that cause.",
  });

  return sendEmail({
    to: donation.email,
    // Receipt: the trust keeps a hidden copy
    copyTrust: true,
    subject:
      lang === "hi"
        ? `दान की रसीद - ${t(cause, lang)} - JBC Seva Trust`
        : `Donation receipt - ${cause} - JBC Seva Trust`,
    text,
    html,
    // Without a PDF the email still goes, with the download button
    attachments: certificatePath
      ? [
          {
            filename: path.basename(certificatePath),
            path: certificatePath,
            contentType: "application/pdf",
          },
        ]
      : [],
  });
}

module.exports = {
  sendDonationCertificateEmail,
};
