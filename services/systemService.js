const { sendTestEmail } = require("./emailService");

async function runEmailTest() {
  return sendTestEmail();
}

module.exports = { runEmailTest };
