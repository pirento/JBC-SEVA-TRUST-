const { appendRecord, readRecords } = require("./fileStore");

// ========================================
// CORRECTED RECORDS
// ========================================
//
// Payment and request records are never rewritten. When the admin
// corrects one (a mistyped email, a spelling), an EDIT record is
// appended; readers get the record with its edits applied and the
// history in `edits`, so the original is still on file for audit.
// ========================================

// Which field identifies a record in each file
const ID_KEY = {
  "donations.txt": "transactionId",
  "payment.txt": "transactionId",
  "user.txt": "referenceRegistrationNumber",
};

async function readCorrected(fileName) {
  const records = await readRecords(fileName);
  const key = ID_KEY[fileName];
  const edits = new Map();

  for (const record of records) {
    if (record.type !== "EDIT") continue;
    if (!edits.has(record.target)) edits.set(record.target, []);
    edits.get(record.target).push(record);
  }

  const result = [];
  for (const record of records) {
    if (record.type === "EDIT") continue;
    const list = edits.get(record[key]);
    result.push(
      list
        ? Object.assign({}, record, ...list.map((e) => e.changes), { edits: list })
        : record,
    );
  }
  return result;
}

// changes: only the fields that differ; previous: their old values
async function addEdit(fileName, target, changes, previous) {
  if (!ID_KEY[fileName]) throw new Error(`Records in ${fileName} cannot be edited.`);
  return appendRecord(fileName, {
    type: "EDIT",
    target: String(target),
    changes,
    previous,
    editedAt: new Date().toISOString(),
  });
}

module.exports = { readCorrected, addEdit, ID_KEY };
