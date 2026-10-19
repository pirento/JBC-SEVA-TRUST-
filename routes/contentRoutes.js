const router = require("express").Router();

const controller = require("../controllers/contentController");
const createRateLimiter = require("../middleware/rateLimit");
const { sendUpload } = require("../middleware/upload");

const registerLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });

router.get("/updates", controller.updates);
router.get("/events", controller.events);
router.get("/events/:id", controller.event);
router.post("/events/:id/register", registerLimiter, controller.registerEvent);
router.get("/uploads/:file", sendUpload);

module.exports = router;
