const { appendRecord, readRecords } = require("../models/fileStore");
const { appUrl } = require("../config/appConfig");

// ========================================
// SITE SETTINGS (changed from the admin panel)
// ========================================
// Stored encrypted like every other record; the latest one wins.

const FILE = "settings.txt";

const DEFAULTS = {
  googleEnabled: false,
  googleClientId: "",
  googleClientSecret: "",
};

async function getSettings() {
  const records = await readRecords(FILE);
  return { ...DEFAULTS, ...(records.at(-1) || {}) };
}

async function saveSettings(changes) {
  const settings = {
    ...(await getSettings()),
    ...changes,
    savedAt: new Date().toISOString(),
  };
  await appendRecord(FILE, settings);
  return settings;
}

// Google login shows only when it is switched on and fully set up
async function googleLogin() {
  const s = await getSettings();
  return s.googleEnabled && s.googleClientId && s.googleClientSecret ? s : null;
}

// The address Google sends people back to; paste it into Google Cloud
const googleRedirectUri = () => `${appUrl}/auth/google/callback`;

module.exports = { getSettings, saveSettings, googleLogin, googleRedirectUri };
