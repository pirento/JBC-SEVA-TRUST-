const crypto = require("crypto");

const { appendRecord, readRecords } = require("./fileStore");

// Updates (field news with an optional photo), events and event
// registrations. Files are append-only, so a delete is a DELETE record.
const FILES = {
  update: "updates.txt",
  event: "events.txt",
  registration: "event-registrations.txt",
};

async function add(kind, data) {
  const record = {
    type: kind.toUpperCase(),
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  };
  await appendRecord(FILES[kind], record);
  return record;
}

async function remove(kind, id) {
  await appendRecord(FILES[kind], {
    type: "DELETE",
    id,
    createdAt: new Date().toISOString(),
  });
}

async function list(kind) {
  const records = await readRecords(FILES[kind]);
  const deleted = new Set(records.filter((r) => r.type === "DELETE").map((r) => r.id));
  return records.filter((r) => r.type !== "DELETE" && !deleted.has(r.id));
}

async function listUpdates() {
  return (await list("update")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listEvents() {
  return (await list("event")).sort((a, b) =>
    `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`),
  );
}

async function findEvent(id) {
  return (await listEvents()).find((e) => e.id === id) || null;
}

async function listRegistrations(eventId) {
  const all = await list("registration");
  return eventId ? all.filter((r) => r.eventId === eventId) : all;
}

module.exports = {
  addUpdate: (data) => add("update", data),
  addEvent: (data) => add("event", data),
  addRegistration: (data) => add("registration", data),
  removeUpdate: (id) => remove("update", id),
  removeEvent: (id) => remove("event", id),
  listUpdates,
  listEvents,
  findEvent,
  listRegistrations,
};
