function required(value) {
  return String(value ?? "").trim().length > 0;
}

function phone(value) {
  return /^\d{10}$/.test(String(value ?? "").trim());
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

module.exports = { required, phone, email, aadhar, positiveAmount };
