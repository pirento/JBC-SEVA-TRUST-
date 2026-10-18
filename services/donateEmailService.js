const path = require("path");

const { sendEmail } = require("./emailService");

async function sendDonationCertificateEmail({
  donation,
  certificatePath,
}) {
  if (!donation) {
    throw new Error("Donation data is required.");
  }

  if (!certificatePath) {
    throw new Error("Donation certificate path is required.");
  }

  const donorName = String(
    donation.donorName || "Donor"
  ).trim();

  const amount = Number(donation.amount || 0).toFixed(2);

  const transactionId = String(
    donation.transactionId || donation.txnid || ""
  ).trim();

  const paymentMode = String(
    donation.paymentMode || "Online Payment"
  ).trim();

  const subject =
    "Donation Certificate - JBC Seva Trust";

  const text = `
Dear ${donorName},

Thank you for your generous donation to JBC Seva Trust.

Donation Details:
-------------------------
Donor Name: ${donorName}
Donation Amount: ₹${amount}
Payment Mode: ${paymentMode}
Transaction ID: ${transactionId}

Your Donation Certificate is attached with this email.

We sincerely appreciate your valuable contribution and support.

Warm regards,
JBC Seva Trust
`.trim();

  const html = `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 650px;
      margin: auto;
      padding: 30px;
      color: #333;
      line-height: 1.6;
    ">

      <h2 style="
        color: #d97706;
        margin-bottom: 20px;
      ">
        Donation Received Successfully
      </h2>

      <p>
        Dear <strong>${donorName}</strong>,
      </p>

      <p>
        Thank you for your generous donation to
        <strong>JBC Seva Trust</strong>.
      </p>

      <div style="
        background: #f8f8f8;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      ">

        <h3 style="margin-top: 0;">
          Donation Details
        </h3>

        <p>
          <strong>Donor Name:</strong>
          ${donorName}
        </p>

        <p>
          <strong>Donation Amount:</strong>
          ₹${amount}
        </p>

        <p>
          <strong>Payment Mode:</strong>
          ${paymentMode}
        </p>

        <p>
          <strong>Transaction ID:</strong>
          ${transactionId}
        </p>

      </div>

      <p>
        Your <strong>Donation Certificate</strong>
        is attached with this email.
      </p>

      <p>
        We sincerely appreciate your valuable contribution
        and support towards our charitable initiatives.
      </p>

      <p style="margin-top: 30px;">
        Warm regards,<br>
        <strong>JBC Seva Trust</strong>
      </p>

    </div>
  `;

  return sendEmail({
    to: donation.email,
    replyTo: donation.email,
    subject,
    text,
    html,
    attachments: [
      {
        filename: path.basename(certificatePath),
        path: certificatePath,
      },
    ],
  });
}

module.exports = {
  sendDonationCertificateEmail,
};