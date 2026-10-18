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

function aadhar(value) {
  return /^\d{12}$/.test(String(value ?? "").trim());
}

function positiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

// YYYY-MM-DD, a real calendar date, not in the future
function pastDate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === text &&
    date <= new Date() &&
    date.getUTCFullYear() >= 1900
  );
}

// HTML checkboxes send "on" when ticked
function accepted(value) {
  return value === "on" || value === "true" || value === true;
}

module.exports = { required, phone, email, aadhar, positiveAmount, pastDate, accepted };
