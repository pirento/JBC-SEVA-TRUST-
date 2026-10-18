const router = require("express").Router();
const controller = require("../controllers/donationController");
router.get("/", controller.showDonationForm);
router.post("/", controller.submitDonation);
router.post("/success", controller.paymentSuccess);
router.post("/failure", controller.paymentFailure);
router.get("/receipt/:transactionId", controller.downloadReceipt);
module.exports = router;
