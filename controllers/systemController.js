const { runEmailTest } = require("../services/systemService");
const { user } = require("../config/emailConfig");
const membershipService = require("../services/membershipService");
const donationService = require("../services/donationService");

async function testEmail(req, res) {
  try {
    await runEmailTest();
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Email Test</title></head><body><h1>✅ Email Sent Successfully</h1><p>Test email has been sent to:</p><strong>${user || "Not configured"}</strong><p>Please check your Gmail inbox.</p><br><a href="/">Go Back Home</a></body></html>`);
  } catch (error) {
    console.error("❌ Test email failed:", error.message);
    res.status(500).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Email Error</title></head><body><h1>❌ Email Failed</h1><p>${error.message}</p><br><a href="/">Go Back Home</a></body></html>`);
  }
}

// PayU server-to-server webhook: records the payment even when the
// customer never returns to the success URL (closed app, tab reload).
async function payuWebhook(req, res) {
  const data = req.body || {};
  try {
    const product = String(data.productinfo || "").toLowerCase();
    const service =
      product === "donation" ? donationService :
      product === "membership" ? membershipService : null;

    if (!service || String(data.status || "").toLowerCase() !== "success") {
      return res.status(200).send("ignored");
    }

    const result = await service.processPaymentSuccess(data);
    console.log("🔔 PAYU WEBHOOK:", data.txnid, result.error || "processed");
    return res.status(200).send(result.error ? "rejected" : "ok");
  } catch (error) {
    console.error("❌ PayU webhook failed:", error.message);
    // Non-200 makes PayU retry the webhook later.
    return res.status(500).send("error");
  }
}

module.exports = { testEmail, payuWebhook };
