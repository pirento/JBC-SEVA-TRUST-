const router = require("express").Router();
const controller = require("../controllers/systemController");
const adminAuth = require("../middleware/adminAuth");
router.get("/test-email", adminAuth, controller.testEmail);
router.post("/payu/webhook", controller.payuWebhook);
module.exports = router;
