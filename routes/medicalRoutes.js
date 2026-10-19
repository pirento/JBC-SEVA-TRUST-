const router = require("express").Router();
const controller = require("../controllers/medicalController");
const honeypot = require("../middleware/honeypot");
router.get("/", controller.showMedicalForm);
router.post("/", honeypot, controller.submitMedical);
router.get("/success", controller.showMedicalSuccess);
router.get("/receipt/:fileName", controller.downloadReceipt);
module.exports = router;
