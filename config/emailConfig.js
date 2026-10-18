module.exports = {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS,
  // Trust inbox that gets a copy of every email and the daily report
  trustEmail: process.env.TRUST_EMAIL || process.env.EMAIL_USER,
};
