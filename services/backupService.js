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

// Photos and medical receipts never change once written (random or
// unique names). A file already in the previous backup is hard-linked
// to it instead of copied again, so each nightly backup is complete
// but takes no extra space for those files. Links fail on some disks;
// then the file is simply copied.
async function copyFiles(from, to, previous, keep = () => true) {
  const entries = await fs.readdir(from, { withFileTypes: true }).catch(() => []);
  await fs.mkdir(to, { recursive: true });

  for (const entry of entries) {
    if (!entry.isFile() || !keep(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);

    try {
      if (!previous) throw new Error("no earlier backup");
      const old = path.join(previous, entry.name);
      const [before, now] = await Promise.all([fs.stat(old), fs.stat(src)]);
      if (before.size !== now.size) throw new Error("changed");
      await fs.link(old, dest);
    } catch {
      await fs.copyFile(src, dest);
    }
  }
}

async function runBackup() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const target = path.join(backupRoot(), stamp);

  // Newest earlier backup, to link unchanged photos and receipts to
  const earlier = (await fs.readdir(backupRoot()).catch(() => []))
    .filter((name) => name !== stamp)
    .sort();
  const previous = earlier.length ? path.join(backupRoot(), earlier.at(-1)) : null;

  await fs.mkdir(target, { recursive: true });

  const entries = await fs.readdir(dataDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const src = path.join(dataDir, entry.name);
    // Records change every day: always a fresh copy
    if (entry.isFile() && entry.name.endsWith(".txt")) {
      await fs.copyFile(src, path.join(target, entry.name));
    } else if (entry.isDirectory() && entry.name === "uploads") {
      await copyFiles(
        src,
        path.join(target, "uploads"),
        previous && path.join(previous, "uploads"),
      );
    } else if (entry.isDirectory() && entry.name === "receipts") {
      // Medical receipts cannot be made again; donation certificates can
      await copyFiles(
        src,
        path.join(target, "receipts"),
        previous && path.join(previous, "receipts"),
        (name) => name.startsWith("Medical-Help-Receipt-"),
      );
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
