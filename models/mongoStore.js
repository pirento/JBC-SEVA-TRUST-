const { MongoClient } = require("mongodb");

const { encrypt, decrypt } = require("../services/encryptionService");

// ========================================
// MONGODB STORAGE
// ========================================
//
// Same interface as the file store (appendRecord / readRecords), so the
// rest of the app does not change. Each data file becomes a collection
// ("donations.txt" -> "donations"); each record is one document holding
// the same AES-256-GCM encrypted text as before, so personal data stays
// unreadable even to someone with database access.
//
// Records are only ever added (edits and deletions are new records),
// so the order they were added in is the order they are read in.
//
// shortcut: whole collections are read and decrypted (cached until a
// new record arrives), like the file store. Store searchable fields in
// clear with indexes once records reach the tens of thousands.
// ========================================

const DB_NAME = process.env.MONGODB_DB || "jbc_seva_trust";

// Second guard: tests must never write into the live database
if (process.env.NODE_ENV === "test" && !/test/.test(DB_NAME)) {
  throw new Error(`Tests may only use a test database, not "${DB_NAME}".`);
}

let clientPromise = null;

// One connection for the whole app, opened on first use
function getClient() {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    }).catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

async function collection(fileName) {
  const client = await getClient();
  return client.db(DB_NAME).collection(String(fileName).replace(/\.txt$/, ""));
}

// ========================================
// READ CACHE
// ========================================
// Decrypted records per collection, reused while the newest document and
// the count are unchanged (two cheap queries instead of decrypting all).

const cache = new Map();

// ========================================
// APPEND
// ========================================

async function appendRecord(fileName, record) {
  const col = await collection(fileName);
  await col.insertOne({ data: encrypt(record), createdAt: new Date() });
  cache.delete(fileName);
  return { fileName, record };
}

// Many at once, in order (used by the migration script)
async function appendRecords(fileName, records) {
  if (records.length === 0) return 0;
  const col = await collection(fileName);
  const now = new Date();
  await col.insertMany(
    records.map((record) => ({ data: encrypt(record), createdAt: now })),
  );
  cache.delete(fileName);
  return records.length;
}

// ========================================
// READ
// ========================================

async function readRecords(fileName) {
  const col = await collection(fileName);

  const [newest, count] = await Promise.all([
    col.findOne({}, { sort: { _id: -1 }, projection: { _id: 1 } }),
    col.estimatedDocumentCount(),
  ]);
  if (!newest) return [];

  const cached = cache.get(fileName);
  if (!cached || cached.count !== count || !cached.newestId.equals(newest._id)) {
    const docs = await col
      .find({}, { sort: { _id: 1 }, projection: { data: 1 } })
      .toArray();
    const records = docs.map((doc) => {
      try {
        return decrypt(doc.data);
      } catch (error) {
        console.error("❌ Failed to decrypt record in", fileName, error.message);
        throw new Error(
          "Encrypted data could not be decrypted. Check DATA_ENCRYPTION_KEY.",
        );
      }
    });
    cache.set(fileName, { count, newestId: newest._id, records });
  }

  // Copies, so callers can change a record without touching the cache
  return cache.get(fileName).records.map((record) => ({ ...record }));
}

// ========================================
// BACKUP EXPORT AND SHUTDOWN
// ========================================

// Writes every collection as "<name>.txt", one encrypted record per line:
// the same format as the file store, so a backup can be restored with
// scripts/migrateToMongo.js. Sessions are not backed up.
async function exportAll(writeFile) {
  const client = await getClient();
  const db = client.db(DB_NAME);
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => name !== "sessions");

  for (const name of names) {
    const docs = await db
      .collection(name)
      .find({}, { sort: { _id: 1 }, projection: { data: 1 } })
      .toArray();
    await writeFile(`${name}.txt`, docs.map((doc) => doc.data).join("\n") + "\n");
  }
  return names;
}

async function closeDatabase() {
  if (!clientPromise) return;
  const client = await clientPromise.catch(() => null);
  clientPromise = null;
  if (client) await client.close();
}

module.exports = {
  appendRecord,
  appendRecords,
  readRecords,
  exportAll,
  closeDatabase,
  getClient,
  DB_NAME,
};
