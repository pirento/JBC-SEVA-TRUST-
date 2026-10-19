const nodemailer = require("nodemailer");
const { logoAttachment, LOGO_CID, renderEmail } = require("./emailTemplate");
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

  // Branded emails show the logo from an attachment (cid:jbc-logo)
  const withLogo = String(html || "").includes(`cid:${LOGO_CID}`)
    ? [...attachments, ...logoAttachment()]
    : attachments;

  return {
    from: `"JBC Seva Trust" <${user}>`,
    to,
    bcc,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
    attachments: withLogo,
  };
}

async function sendEmail(options) {
  // Fail fast instead of waiting minutes on an SMTP login that cannot work
  if (!user || !pass) {
    throw new Error("Email is not configured (EMAIL_USER / EMAIL_PASS)");
  }

  if (!options.to) {
    throw new Error("Recipient email is required");
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
  const { html, text } = renderEmail({
    heading: "Email is working",
    paragraphs: [
      "This is a test email from the JBC Seva Trust website. Emails to donors and the trust will be sent from this address.",
    ],
  });

  return sendEmail({ to: user, subject: "Test email - JBC Seva Trust", text, html });
}

module.exports = {
  buildMailOptions,
  sendEmail,
  verifyEmailConnection,
  sendTestEmail,
};
