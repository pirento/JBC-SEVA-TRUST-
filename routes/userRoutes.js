const router = require("express").Router();

const controller = require("../controllers/userController");
const userAuth = require("../middleware/userAuth");
const createRateLimiter = require("../middleware/rateLimit");

const loginLimiter = createRateLimiter();
const passwordLimiter = createRateLimiter();
const registerLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 });

router.get("/register", controller.showRegister);
router.post("/register", registerLimiter, controller.register);

router.get("/login", controller.showLogin);
router.post("/login", loginLimiter, controller.login);

router.post("/logout", controller.logout);

router.get("/account", userAuth, controller.account);
router.post("/account/password", userAuth, passwordLimiter, controller.changePassword);

module.exports = router;
