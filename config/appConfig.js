const path = require("path");

const port = Number(process.env.PORT) || 3000;

module.exports = {
  port,
  // Public address of the site, used in links sent by email
  appUrl: (process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, ""),
  nodeEnv: process.env.NODE_ENV || "development",
  rootDir: path.join(__dirname, ".."),
  dataDir: process.env.DATA_DIR || path.join(__dirname, "..", "data"),
  publicDir: path.join(__dirname, "..", "public"),
  viewsDir: path.join(__dirname, "..", "views"),
};
