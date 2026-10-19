const settingsService = require("../services/settingsService");
const { sendTestEmail } = require("../services/emailService");

// ========================================
// SETTINGS (Google login)
// ========================================

async function show(req, res, next) {
  try {
    const settings = await settingsService.getSettings();
    return res.render("admin/settings", {
      settings,
      redirectUri: settingsService.googleRedirectUri(),
      notice:
        req.query.saved === "1"
          ? "Settings saved."
          : req.query.email === "sent"
            ? "Test email sent. Check the trust's Gmail inbox."
            : "",
      error: null,
    });
  } catch (error) {
    return next(error);
  }
}

async function save(req, res, next) {
  try {
    const body = req.body || {};
    const current = await settingsService.getSettings();
    const clientId = String(body.googleClientId || "").trim();
    // The secret is never shown again; an empty box keeps the saved one
    const clientSecret =
      body.clearSecret === "on"
        ? ""
        : String(body.googleClientSecret || "").trim() ||
          current.googleClientSecret ||
          "";
    const enabled = body.googleEnabled === "on";

    const problem =
      clientId && !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId)
        ? "The Client ID should end with .apps.googleusercontent.com"
        : clientId.length > 200 || clientSecret.length > 200
          ? "Client ID or secret is too long."
          : enabled && (!clientId || !clientSecret)
            ? "Enter the Client ID and Client secret before switching Google login on."
            : null;

    if (problem) {
      return res.status(400).render("admin/settings", {
        settings: { ...current, googleClientId: clientId, googleEnabled: enabled },
        redirectUri: settingsService.googleRedirectUri(),
        notice: "",
        error: problem,
      });
    }

    await settingsService.saveSettings({
      googleEnabled: enabled,
      googleClientId: clientId,
      googleClientSecret: clientSecret,
    });
    return res.redirect("/admin/settings?saved=1");
  } catch (error) {
    return next(error);
  }
}

// Sends one email to the trust's own address to check EMAIL_USER / EMAIL_PASS
async function testEmail(req, res, next) {
  try {
    await sendTestEmail();
    return res.redirect("/admin/settings?email=sent");
  } catch (error) {
    console.error("Test email failed:", error.message);
    try {
      return res.status(500).render("admin/settings", {
        settings: await settingsService.getSettings(),
        redirectUri: settingsService.googleRedirectUri(),
        notice: "",
        error: `Test email failed: ${error.message}`,
      });
    } catch (renderError) {
      return next(renderError);
    }
  }
}

module.exports = { show, save, testEmail };
