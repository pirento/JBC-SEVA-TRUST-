const enquiryModel = require("../models/enquiryModel");
const { sendEmail } = require("./emailService");
const { trustEmail } = require("../config/emailConfig");
const trust = require("../config/trustConfig");
const escapeHtml = require("../utils/escapeHtml");
const { required, phone, email, accepted } = require("../utils/validation");

// User-facing errors; anything else is a server fault
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

function contact(input) {
  const cleanEmail = String(input.email || "").trim().toLowerCase();
  const cleanPhone = String(input.phone || "").trim();

  if (!email(cleanEmail)) throw invalid("Please enter a valid email address.");
  if (!phone(cleanPhone)) throw invalid("Please enter a valid 10 digit mobile number.");
  if (!accepted(input.consent)) throw invalid("Please accept the Terms and Privacy Policy.");

  return { email: cleanEmail, phone: cleanPhone };
}

// Tell the trust inbox; a failed email must not lose the submission
function notifyTrust(subject, rows) {
  if (!trustEmail) return;

  const html =
    `<h2 style="color:#14365d">${escapeHtml(subject)}</h2><table>` +
    rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0"><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("") +
    "</table>";

  sendEmail({
    to: trustEmail,
    subject: `${subject} - ${trust.name}`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    html,
  }).catch((error) => console.error("❌ Enquiry email failed:", error.message));
}

async function registerVolunteer(input) {
  const areas = [].concat(input.areas || []).filter((area) => trust.volunteerAreas.includes(area));
  const availability = trust.volunteerAvailability.includes(input.availability) ? input.availability : "";

  const record = {
    name: text(input.name, 100, "Name"),
    ...contact(input),
    city: text(input.city, 100, "Village / city"),
    areas,
    availability,
    message: text(input.message, 1000, "Message", { optional: true }),
  };

  if (areas.length === 0) throw invalid("Please choose at least one area you would like to help with.");
  if (!availability) throw invalid("Please choose when you are available.");

  await enquiryModel.addVolunteer(record);

  notifyTrust("New volunteer registration", [
    ["Name", record.name],
    ["Mobile", record.phone],
    ["Email", record.email],
    ["Village / city", record.city],
    ["Areas", areas.join(", ")],
    ["Availability", availability],
    ["Message", record.message],
  ]);

  return record;
}

async function sendMessage(input) {
  const enquiryType = trust.enquiryTypes.includes(input.enquiryType) ? input.enquiryType : "";
  if (!enquiryType) throw invalid("Please choose what your message is about.");

  const record = {
    name: text(input.name, 100, "Name"),
    ...contact(input),
    organisation: text(input.organisation, 150, "Organisation", { optional: true }),
    enquiryType,
    message: text(input.message, 2000, "Message"),
  };

  await enquiryModel.addMessage(record);

  notifyTrust(`New message: ${enquiryType}`, [
    ["Name", record.name],
    ["Organisation", record.organisation],
    ["Mobile", record.phone],
    ["Email", record.email],
    ["Message", record.message],
  ]);

  return record;
}

module.exports = { registerVolunteer, sendMessage };
