const crypto = require("crypto");

const { appendRecord, readRecords } = require("./fileStore");

const VOLUNTEER_FILE = "volunteers.txt";
const MESSAGE_FILE = "messages.txt";

function newestFirst(records) {
  return [...records].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function addVolunteer(data) {
  const record = {
    type: "VOLUNTEER",
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  };

  await appendRecord(VOLUNTEER_FILE, record);
  return record;
}

async function addMessage(data) {
  const record = {
    type: "MESSAGE",
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  };

  await appendRecord(MESSAGE_FILE, record);
  return record;
}

async function listVolunteers() {
  return newestFirst(await readRecords(VOLUNTEER_FILE));
}

async function listMessages() {
  return newestFirst(await readRecords(MESSAGE_FILE));
}

module.exports = { addVolunteer, addMessage, listVolunteers, listMessages };
