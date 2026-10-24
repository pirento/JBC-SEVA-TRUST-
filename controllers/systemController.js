const membershipService = require("../services/membershipService");
const donationService = require("../services/donationService");

// PayU server-to-server webhook: records the payment even when the
// customer never returns to the success URL (closed app, tab reload).
async function payuWebhook(req, res) {
  const data = req.body || {};
  try {
    const product = String(data.productinfo || "").toLowerCase();
    const service =
      product === "donation"
        ? donationService
        : product === "membership"
          ? membershipService
          : null;

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

module.exports = { payuWebhook };
