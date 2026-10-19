const { renderCertificatePdf, safe, formatDate, getDate } = require("./certificateDesign");

// ============================================================
// CERTIFICATE NUMBER
// ============================================================

function generateCertificateNumber(data) {
  if (data.certificateNumber) return safe(data.certificateNumber);
  if (data.receiptNumber) return safe(data.receiptNumber);

  const cleanId = safe(data.txnid || data.transactionId, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10);

  return cleanId ? `JBCM${cleanId.toUpperCase()}` : `JBCM${Date.now()}`;
}

// ============================================================
// VALID TILL
// ============================================================

function getValidTill(value, membershipType) {
  if (String(membershipType || "").toLowerCase() === "lifetime member") {
    return "Lifetime";
  }

  const date = getDate(value);
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

// ============================================================
// GENERATE MEMBERSHIP CERTIFICATE (resolves with a PDF Buffer)
// ============================================================

function generateMembershipCertificate(data) {
  const memberName = String(data.memberName || data.donorName || "").trim() || "Member";
  const membershipType = safe(
    data.membershipType,
    Number(data.amount) >= 11000 ? "Lifetime Member" : "1 Year Member"
  );

  return renderCertificatePdf({
    docTitle: "Membership Certificate",
    eyebrow: "Certificate of Membership",
    title: "Membership Certificate",
    lead: "This is to certify that",
    name: memberName,
    statement:
      `has joined JBC Seva Trust as a ${membershipType.toLowerCase()}. ` +
      "We welcome you to our family of members who stand with elders, children, poor families and nature.",
    amount: data.amount,
    certificateNumber: generateCertificateNumber(data),
    date: data.paymentDate,
    details: [
      ["Membership", membershipType],
      ["Valid Till", getValidTill(data.paymentDate, membershipType)],
      ["Payment Mode", safe(data.paymentMode, "Online")],
      ["Transaction ID", safe(data.txnid || data.transactionId, "N/A")],
      ["Payment ID", safe(data.mihpayid || data.payuPaymentId, "")],
    ],
    note:
      "Membership does not give ownership, voting or management rights in the Trust. " +
      "80G tax-exemption receipts will be issued only after the Trust receives 80G approval. " +
      "This is a computer-generated certificate.",
  });
}

module.exports = {
  generateMembershipCertificate,
};
