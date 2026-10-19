const nodemailer = require("nodemailer");
const { user, pass, trustEmail } = require("../config/emailConfig");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user, pass },
});

async function verifyEmailConnection() {
  try {
    await transporter.verify();

    console.log("=================================");
    console.log("✅ Nodemailer is ready");
    console.log("📧 Sender:", user);
    console.log("=================================");

    return true;
  } catch (error) {
    console.log("=================================");
    console.log("❌ Nodemailer connection failed");
    console.log("Error:", error.message);
    console.log("=================================");

    return false;
  }
}

// Who receives a message. The trust inbox gets a hidden copy (BCC) only
// of receipts (copyTrust: true), never of password or confirmation
// links, which must reach the account owner alone.
function buildMailOptions({
  to,
  replyTo,
  subject,
  text,
  html,
  attachments = [],
  copyTrust = false,
}) {
  const bcc = copyTrust && trustEmail && trustEmail !== to ? trustEmail : undefined;

  return {
    from: `"JBC Seva Trust" <${user}>`,
    to,
    bcc,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
    attachments,
  };
}

async function sendEmail(options) {
  if (!options.to) {
    throw new Error("Recipient email is required");
  }

  // Fail fast instead of waiting minutes on an SMTP login that cannot work
  if (!user || !pass) {
    throw new Error("Email is not configured (EMAIL_USER / EMAIL_PASS)");
  }

  const mail = buildMailOptions(options);
  const { subject, attachments } = mail;
  const info = await transporter.sendMail(mail);

  console.log("=================================");
  console.log("✅ Email sent successfully");
  // Addresses are personal data; the log keeps only what was sent
  console.log("📝 Subject:", subject);
  console.log("📎 Attachments:", attachments.length);
  console.log("🆔 Message ID:", info.messageId);
  console.log("=================================");

  return info;
}

async function sendTestEmail() {
  return sendEmail({
    to: user,
    replyTo: user,

    subject: "JBC Seva Trust Nodemailer Test",

    text:
      "Congratulations!\n\n" +
      "Nodemailer is working successfully.\n\n" +
      "This is a test email from JBC Seva Trust.",

    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        padding: 30px;
      ">
        <h2>Nodemailer Test Successful</h2>

        <p>Congratulations!</p>

        <p>
          Your Nodemailer email system is working successfully.
        </p>

        <p>
          This is a test email from JBC Seva Trust.
        </p>
      </div>
    `,
  });
}

module.exports = {
  buildMailOptions,
  sendEmail,
  verifyEmailConnection,
  sendTestEmail,
};
