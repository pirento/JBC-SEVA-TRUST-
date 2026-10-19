const { test } = require("node:test");
const assert = require("node:assert/strict");

const v = require("../utils/validation");
const escapeHtml = require("../utils/escapeHtml");

test("phone accepts only 10 digit Indian mobiles", () => {
  assert.ok(v.phone("9876543210"));
  assert.ok(v.phone(" 6000000000 "));
  assert.ok(!v.phone("5876543210"));
  assert.ok(!v.phone("987654321"));
  assert.ok(!v.phone("98765432100"));
  assert.ok(!v.phone("98765abcde"));
});

test("pastDate accepts real past dates only", () => {
  assert.ok(v.pastDate("1990-12-31"));
  assert.ok(!v.pastDate("2999-01-01"));
  assert.ok(!v.pastDate("2021-02-29"));
  assert.ok(!v.pastDate("1850-01-01"));
  assert.ok(!v.pastDate("10/05/1990"));
  assert.ok(!v.pastDate(""));
});

test("aadhar, email, consent", () => {
  assert.ok(v.aadhar("123412341234"));
  assert.ok(!v.aadhar("1234 1234 1234"));
  assert.ok(v.email("a@b.co"));
  assert.ok(!v.email("a@b"));
  assert.ok(v.accepted("on"));
  assert.ok(!v.accepted(undefined));
  assert.ok(!v.accepted("off"));
});

test("escapeHtml neutralises markup", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="a">'`),
    "&lt;img src=x onerror=&quot;a&quot;&gt;&#039;",
  );
});

test("emails: trust gets a hidden copy of receipts only", () => {
  process.env.TRUST_EMAIL = "trust@example.org";
  delete require.cache[require.resolve("../config/emailConfig")];
  delete require.cache[require.resolve("../services/emailService")];
  const { buildMailOptions } = require("../services/emailService");

  const receipt = buildMailOptions({
    to: "donor@example.com",
    subject: "Receipt",
    copyTrust: true,
  });
  assert.equal(receipt.to, "donor@example.com");
  assert.equal(receipt.bcc, "trust@example.org", "hidden copy, not in To");

  const reset = buildMailOptions({
    to: "donor@example.com",
    subject: "Reset your password",
  });
  assert.equal(reset.bcc, undefined, "password links go to the owner alone");

  const notice = buildMailOptions({
    to: "trust@example.org",
    replyTo: "volunteer@example.com",
    copyTrust: true,
  });
  assert.equal(notice.bcc, undefined, "no duplicate copy to the same inbox");
  assert.equal(notice.replyTo, "volunteer@example.com");
});
