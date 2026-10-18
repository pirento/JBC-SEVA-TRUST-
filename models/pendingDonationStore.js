const { appendRecord, readRecords } = require("./fileStore");

const PENDING_FILE = "pending-payments.txt";
const receipts = new Map();
const MAX_AGE = 30 * 60 * 1000;

async function setPending(id, data) {
  const transactionId = String(id || "").trim();
  if (!transactionId || !data || typeof data !== "object") {
    throw new Error("Valid transaction ID and pending payment data are required.");
  }

  // Append-only encrypted event log: no in-memory dependency and no destructive rewrite.
  await appendRecord(PENDING_FILE, {
    transactionId,
    state: "PENDING",
    createdAt: Date.now(),
    data: { ...data, txnid: transactionId }
  });
}

async function getPending(id) {
  const transactionId = String(id || "").trim();
  if (!transactionId) return null;

  const records = await readRecords(PENDING_FILE);
  // The last event for a transaction determines its state.
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    if (String(record.transactionId || "") !== transactionId) continue;
    if (record.state !== "PENDING") return null;
    return record.data || null;
  }
  return null;
}

async function deletePending(id) {
  const transactionId = String(id || "").trim();
  if (!transactionId) return;
  await appendRecord(PENDING_FILE, {
    transactionId,
    state: "CLOSED",
    createdAt: Date.now()
  });
}

function setReceipt(id, receipt) { receipts.set(String(id), receipt); }
function getReceipt(id) { return receipts.get(String(id)); }
function deleteReceipt(id) { receipts.delete(String(id)); }

// Kept for compatibility with existing services. Persistent records are
// retained as an audit trail; old pending records are not automatically deleted.
function cleanup() {
  const now = Date.now();
  for (const [id, value] of receipts) {
    if (now - value.createdAt > MAX_AGE) receipts.delete(id);
  }
}

// shortcut: in-process lock, fine for one Node process; use a DB unique key if you run several instances.
const inFlight = new Map();
function withTxnLock(id, fn) {
  const key = String(id || "");
  const run = (inFlight.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  inFlight.set(key, run);
  run.catch(() => {}).finally(() => { if (inFlight.get(key) === run) inFlight.delete(key); });
  return run;
}

module.exports = {
  withTxnLock,
  MAX_AGE, setPending, getPending, deletePending,
  setReceipt, getReceipt, deleteReceipt, cleanup
};
