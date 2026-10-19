// Usage: npm run backup
require("dotenv").config();

// Close the database connection when done, or the script would not exit
const done = () =>
  process.env.MONGODB_URI ? require("../models/mongoStore").closeDatabase() : null;

require("../services/backupService")
  .runBackup()
  .then(done)
  .catch(async (error) => {
    console.error("Backup failed:", error.message);
    await done();
    process.exit(1);
  });
