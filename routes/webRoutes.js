const router = require("express").Router();
const controller = require("../controllers/webController");
router.get("/", controller.home);
router.get("/work/:slug", controller.programme);
router.get(Object.keys(controller.legalPages), controller.legal);
module.exports = router;
