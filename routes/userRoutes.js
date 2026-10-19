const router = require("express").Router();

const controller = require("../controllers/userController");
const userAuth = require("../middleware/userAuth");
const createRateLimiter = require("../middleware/rateLimit");
const honeypot = require("../middleware/honeypot");

const loginLimiter = createRateLimiter();
const passwordLimiter = createRateLimiter();
// Generous: many people may share one IP (cyber cafe, mobile network)
const registerLimiter = createRateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });

const { googleLogin } = require("../services/settingsService");

// Login and register pages show "Continue with Google" when it is set up
router.use(["/login", "/register"], async (req, res, next) => {
  try {
    res.locals.googleLogin = Boolean(await googleLogin());
    return next();
  } catch (error) {
    return next(error);
  }
});

router.get("/auth/google", controller.googleStart);
router.get("/auth/google/callback", controller.googleCallback);

router.get("/register", controller.showRegister);
router.post("/register", registerLimiter, honeypot, controller.register);

router.get("/login", controller.showLogin);
router.post("/login", loginLimiter, controller.login);

router.post("/logout", controller.logout);

const forgotLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
router.get("/forgot-password", controller.showForgot);
router.post("/forgot-password", forgotLimiter, controller.forgot);
router.get("/reset-password/:token", controller.showReset);
router.post("/reset-password/:token", passwordLimiter, controller.reset);

router.get("/account", userAuth, controller.account);
router.post("/account/pledges/stop", userAuth, controller.stopPledge);
router.get("/monthly/stop", controller.monthlyStop);
router.post("/monthly/stop", controller.monthlyStop);

const verifyLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
router.get("/verify-email/:token", controller.verifyEmail);
router.post("/account/verify", userAuth, verifyLimiter, controller.resendVerification);
router.post("/account/password", userAuth, passwordLimiter, controller.changePassword);
router.get("/account/set-password", userAuth, controller.showSetPassword);
router.post("/account/set-password", userAuth, passwordLimiter, controller.setPassword);

module.exports = router;
