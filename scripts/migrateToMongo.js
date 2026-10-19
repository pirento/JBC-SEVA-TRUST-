// Copies the records from the encrypted data files into MongoDB.
//
// Usage (with MONGODB_URI and DATA_ENCRYPTION_KEY in .env):
//   npm run migrate:mongo                 data files in DATA_DIR
//   npm run migrate:mongo -- <folder>     e.g. a backup folder to restore
//
// A collection that already holds the same number of records is skipped,
// so running it twice copies nothing twice; a different number is
// reported, never mixed. Photos and PDFs stay in DATA_DIR.
// Run it BEFORE starting the site with MONGODB_URI.
require("dotenv").config();

const fs = require("fs");
const path = require("path");

if (process.argv[2]) process.env.DATA_DIR = path.resolve(process.argv[2]);

if (!process.env.MONGODB_URI) {
  console.error("Set MONGODB_URI in .env first.");
  process.exit(1);
}

const { dataDir } = require("../config/appConfig");
const store = require("../models/fileStore");
const mongo = require("../models/mongoStore");

(async () => {
  const fileNames = fs.readdirSync(dataDir).filter((name) => name.endsWith(".txt"));
  if (fileNames.length === 0) {
    console.log(`No .txt data files in ${dataDir}.`);
  }

  let problems = 0;
  for (const fileName of fileNames) {
    const records = await store.files.readRecords(fileName);
    const already = (await mongo.readRecords(fileName)).length;

    if (already === records.length) {
      console.log(`- ${fileName}: already in MongoDB (${already} record(s)), skipped`);
      continue;
    }
    // A cut-off earlier run, or the site already wrote here: copying again
    // would mix or double records, so stop and say what to do
    if (already > 0) {
      problems += 1;
      console.log(
        `✖ ${fileName}: MongoDB has ${already} record(s), the file ${records.length}. ` +
          `Check which is right; to copy again, drop the "${fileName.replace(/\.txt$/, "")}" collection and rerun.`,
      );
      continue;
    }

    await mongo.appendRecords(fileName, records);
    const copied = (await mongo.readRecords(fileName)).length;
    const ok = copied === records.length;
    if (!ok) problems += 1;
    console.log(
      `${ok ? "✔" : "✖"} ${fileName}: ${records.length} record(s), ${copied} in MongoDB`,
    );
  }

  await mongo.closeDatabase();
  if (problems) {
    console.error(`${problems} file(s) did not copy completely.`);
    process.exit(1);
  }
  console.log("Done. Keep the old data files until the site has run well on MongoDB.");
})().catch(async (error) => {
  console.error("Migration failed:", error.message);
  await mongo.closeDatabase();
  process.exit(1);
});
