const path = require("path");

module.exports = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  rootDir: path.join(__dirname, ".."),
  dataDir: path.join(__dirname, "..", "data"),
  publicDir: path.join(__dirname, "..", "public"),
  viewsDir: path.join(__dirname, "..", "views"),
};
