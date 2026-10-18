const router = require("express").Router();
const controller = require("../controllers/webController");
router.get("/", controller.home);
module.exports = router;
