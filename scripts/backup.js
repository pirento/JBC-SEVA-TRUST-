// Usage: npm run backup
require("dotenv").config();
require("../services/backupService")
  .runBackup()
  .catch((error) => {
    console.error("Backup failed:", error.message);
    process.exit(1);
  });
