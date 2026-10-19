const fs = require("fs");

const contentModel = require("../models/contentModel");
const trust = require("../config/trustConfig");
const { sendEmail } = require("./emailService");
const { trustEmail } = require("../config/emailConfig");
const { required, phone, email, accepted } = require("../utils/validation");

function invalid(message) {
  const error = new Error(message);
  error.expose = true;
  return error;
}

function text(value, max, label, { optional = false } = {}) {
  const clean = String(value ?? "").trim();
  if (!optional && !required(clean)) throw invalid(`${label} is required.`);
  if (clean.length > max) throw invalid(`${label} cannot exceed ${max} characters.`);
  return clean;
}

function programmeSlug(value) {
  const slug = String(value || "");
  if (slug && !trust.programmes.some((p) => p.slug === slug)) throw invalid("Unknown programme.");
  return slug;
}

const today = () => new Date().toISOString().slice(0, 10);

// ---------------- Updates ----------------

async function createUpdate(input, file, uploadError) {
  try {
    if (uploadError) throw invalid(uploadError);

    return await contentModel.addUpdate({
      programme: programmeSlug(input.programme),
      title: text(input.title, 120, "Title"),
      body: text(input.body, 2000, "Description"),
      place: text(input.place, 100, "Place", { optional: true }),
      date: /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ? input.date : today(),
      photo: file ? file.filename : "",
    });
  } catch (error) {
    // Do not keep a photo whose update was rejected
    if (file) fs.unlink(file.path, () => {});
    throw error;
  }
}

// ---------------- Events ----------------

async function createEvent(input) {
  const date = String(input.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw invalid("Please enter a valid event date.");
  if (date < today()) throw invalid("Event date cannot be in the past.");

  const time = String(input.time || "");
  if (time && !/^\d{2}:\d{2}$/.test(time)) throw invalid("Please enter a valid time.");

  return contentModel.addEvent({
    title: text(input.title, 120, "Title"),
    date,
    time,
    place: text(input.place, 150, "Place"),
    programme: programmeSlug(input.programme),
    description: text(input.description, 2000, "Description"),
    volunteersNeeded: input.volunteersNeeded === "on",
  });
}

function isUpcoming(event) {
  return event.date >= today();
}

async function registerForEvent(event, input) {
  if (!event || !isUpcoming(event)) throw invalid("Registration for this event is closed.");

  const cleanEmail = String(input.email || "").trim().toLowerCase();
  const cleanPhone = String(input.phone || "").trim();
  const people = Number(input.people || 1);

  if (!email(cleanEmail)) throw invalid("Please enter a valid email address.");
  if (!phone(cleanPhone)) throw invalid("Please enter a valid 10 digit mobile number.");
  if (!Number.isInteger(people) || people < 1 || people > 20) throw invalid("Number of people must be between 1 and 20.");
  if (!accepted(input.consent)) throw invalid("Please accept the Terms and Privacy Policy.");

  const role = event.volunteersNeeded && input.role === "Volunteer" ? "Volunteer" : "Attend";

  const record = await contentModel.addRegistration({
    eventId: event.id,
    eventTitle: event.title,
    name: text(input.name, 100, "Name"),
    phone: cleanPhone,
    email: cleanEmail,
    people,
    role,
  });

  if (trustEmail) {
    sendEmail({
      to: trustEmail,
      subject: `Event registration: ${event.title} - ${trust.name}`,
      text: `${record.name} (${record.phone}, ${record.email}) registered for ${event.title} on ${event.date}: ${people} person(s), ${role}.`,
    }).catch((error) => console.error("❌ Event email failed:", error.message));
  }

  return record;
}

module.exports = { createUpdate, createEvent, registerForEvent, isUpcoming };
