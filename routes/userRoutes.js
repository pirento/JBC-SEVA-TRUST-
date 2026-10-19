const router = require("express").Router();

const controller = require("../controllers/userController");
const userAuth = require("../middleware/userAuth");
const createRateLimiter = require("../middleware/rateLimit");

const loginLimiter = createRateLimiter();
const passwordLimiter = createRateLimiter();
// Generous: many people may share one IP (cyber cafe, mobile network)
const registerLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });

router.get("/register", controller.showRegister);
router.post("/register", registerLimiter, controller.register);

router.get("/login", controller.showLogin);
router.post("/login", loginLimiter, controller.login);

router.post("/logout", controller.logout);

const forgotLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
router.get("/forgot-password", controller.showForgot);
router.post("/forgot-password", forgotLimiter, controller.forgot);
router.get("/reset-password/:token", controller.showReset);
router.post("/reset-password/:token", passwordLimiter, controller.reset);

router.get("/account", userAuth, controller.account);
router.post("/account/password", userAuth, passwordLimiter, controller.changePassword);

module.exports = router;
