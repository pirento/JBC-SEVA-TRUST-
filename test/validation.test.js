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
