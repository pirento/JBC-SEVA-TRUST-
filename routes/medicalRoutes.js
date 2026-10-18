const router = require("express").Router();
const controller = require("../controllers/medicalController");
router.get("/", controller.showMedicalForm);
router.post("/", controller.submitMedical);
router.get("/success", controller.showMedicalSuccess);
router.get("/receipt/:fileName", controller.downloadReceipt);
module.exports = router;
