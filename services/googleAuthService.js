const crypto = require("crypto");

const { googleLogin, googleRedirectUri } = require("./settingsService");

// ========================================
// GOOGLE LOGIN (OAuth 2.0 authorization code flow)
// ========================================
// No extra package: one redirect to Google, then two HTTPS calls back to
// Google (code -> token, token -> profile). Only a Google-verified email
// is accepted.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

async function startUrl() {
  const settings = await googleLogin();
  if (!settings) return null;

  // Ties Google's answer to this browser session (stops login CSRF)
  const state = crypto.randomBytes(24).toString("hex");
  const query = new URLSearchParams({
    client_id: settings.googleClientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return { url: `${AUTH_URL}?${query}`, state };
}

// Returns { googleId, email, name } or throws
async function finish(code) {
  const settings = await googleLogin();
  if (!settings || !code) throw new Error("Google login is not available.");

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(code),
      client_id: settings.googleClientId,
      client_secret: settings.googleClientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(`Google token request failed (${token.error || tokenRes.status})`);
  }

  const profileRes = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok || !profile.sub || !profile.email) {
    throw new Error("Google did not return a profile.");
  }
  if (profile.email_verified !== true) {
    throw new Error("This Google account's email is not verified.");
  }

  return { googleId: profile.sub, email: profile.email, name: profile.name || "" };
}

module.exports = { startUrl, finish };
