const fs = require("fs/promises");
const path = require("path");
const cron = require("node-cron");

const { dataDir } = require("../config/appConfig");

const KEEP = 30;

// Backups stay encrypted; DATA_ENCRYPTION_KEY must be kept safely
// elsewhere or the backups cannot be read.
function backupRoot() {
  return process.env.BACKUP_DIR || path.join(dataDir, "backups");
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(src, dest);
    else await fs.copyFile(src, dest);
  }
}

async function runBackup() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const target = path.join(backupRoot(), stamp);

  await fs.mkdir(target, { recursive: true });

  const entries = await fs.readdir(dataDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const src = path.join(dataDir, entry.name);
    // Records and uploaded photos; receipts can be regenerated
    if (entry.isFile() && entry.name.endsWith(".txt")) {
      await fs.copyFile(src, path.join(target, entry.name));
    } else if (entry.isDirectory() && entry.name === "uploads") {
      await copyDir(src, path.join(target, "uploads"));
    }
  }

  // Keep only the newest KEEP backups
  const all = (await fs.readdir(backupRoot())).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
    await fs.rm(path.join(backupRoot(), old), { recursive: true, force: true });
  }

  console.log("💾 Backup saved:", target);
  return target;
}

function startBackupScheduler() {
  // Every day at 02:30 India time
  cron.schedule(
    "30 2 * * *",
    () => {
      runBackup().catch((error) => console.error("❌ Backup failed:", error.message));
    },
    { timezone: "Asia/Kolkata" },
  );
}

module.exports = { runBackup, startBackupScheduler, backupRoot };
