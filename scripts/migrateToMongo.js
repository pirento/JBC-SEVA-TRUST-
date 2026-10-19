// Copies the records from the encrypted data files into MongoDB.
//
// Usage (with MONGODB_URI and DATA_ENCRYPTION_KEY in .env):
//   npm run migrate:mongo                 data files in DATA_DIR
//   npm run migrate:mongo -- <folder>     e.g. a backup folder to restore
//
// A collection that already has records is skipped, so running it twice
// does not copy anything twice. Photos and PDFs stay in DATA_DIR.
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

    if (already > 0) {
      console.log(`- ${fileName}: skipped, MongoDB already has ${already} record(s)`);
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
