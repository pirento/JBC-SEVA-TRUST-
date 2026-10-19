function required(value) {
  return String(value ?? "").trim().length > 0;
}

// Indian mobile numbers: 10 digits starting with 6-9
function phone(value) {
  return /^[6-9]\d{9}$/.test(String(value ?? "").trim());
}

function email(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

// Verhoeff check digit tables (UIDAI uses this for the 12th digit)
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// 12 digits, not starting with 0 or 1, with a valid check digit, so a
// one-digit typo is caught (and does not slip past the duplicate check)
function aadhar(value) {
  const text = String(value ?? "").trim();
  if (!/^[2-9]\d{11}$/.test(text)) return false;
  let c = 0;
  [...text].reverse().forEach((digit, i) => {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(digit)]];
  });
  return c === 0;
}

function positiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

// YYYY-MM-DD that exists on the calendar (no 2026-02-30 or 2026-13-01)
function realDate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// Today in India as YYYY-MM-DD (the app runs in Indian time)
const todayIndia = () => new Date().toLocaleDateString("en-CA");

// A real calendar date, not in the future
function pastDate(value) {
  const text = String(value ?? "").trim();
  return realDate(text) && text <= todayIndia() && text >= "1900-01-01";
}

// HTML checkboxes send "on" when ticked
function accepted(value) {
  return value === "on" || value === "true" || value === true;
}

// A person's name: has a letter, no links or markup (common in spam)
function personName(value) {
  const text = String(value ?? "").trim();
  return (
    /\p{L}/u.test(text) && !/https?:|www\.|[<>]|\.(com|net|org|ru|xyz)\b/i.test(text)
  );
}

// Free text with at most a couple of links
function fewLinks(value, max = 2) {
  return (String(value ?? "").match(/https?:\/\/|www\./gi) || []).length <= max;
}

module.exports = {
  required,
  phone,
  email,
  aadhar,
  positiveAmount,
  pastDate,
  realDate,
  todayIndia,
  accepted,
  personName,
  fewLinks,
};
