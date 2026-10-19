const router = require("express").Router();
const controller = require("../controllers/membershipController");
router.get("/", controller.showMembershipForm);
router.post("/", controller.submitMembership);
router.post("/success", controller.paymentSuccess);
router.post("/failure", controller.paymentFailure);
router.get("/receipt/:transactionId", controller.downloadReceipt);
module.exports = router;
