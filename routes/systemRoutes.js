const router = require("express").Router();
const controller = require("../controllers/systemController");
router.post("/payu/webhook", controller.payuWebhook);
module.exports = router;
