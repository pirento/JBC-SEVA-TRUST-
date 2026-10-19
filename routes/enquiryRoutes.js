const router = require("express").Router();

const controller = require("../controllers/enquiryController");
const createRateLimiter = require("../middleware/rateLimit");
const honeypot = require("../middleware/honeypot");

// Spam guard: at most 10 submissions per hour per IP for each form
const volunteerLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 });
const contactLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 });

router.get("/volunteer", controller.showVolunteer);
router.post("/volunteer", volunteerLimiter, honeypot, controller.submitVolunteer);

router.get("/contact", controller.showContact);
router.post("/contact", contactLimiter, honeypot, controller.submitContact);

module.exports = router;
