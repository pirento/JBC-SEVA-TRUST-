// End-to-end tests: start the real app on a random port with a
// throwaway data folder and drive it over HTTP.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const bcrypt = require("bcrypt");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "jbc-test-"));
const ADMIN_PASSWORD = "Admin-Test-123";

Object.assign(process.env, {
  NODE_ENV: "test",
  DATA_DIR: dataDir,
  DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"),
  SESSION_SECRET: "test-secret",
  ADMIN_PASSWORD_HASH: bcrypt.hashSync(ADMIN_PASSWORD, 4),
  PAYU_KEY: "testkey",
  PAYU_SALT: "testsalt",
  PAYU_DONATION_SUCCESS_URL: "http://localhost/donate/success",
  PAYU_DONATION_FAILURE_URL: "http://localhost/donate/failure",
  EMAIL_USER: "",
  EMAIL_PASS: "",
});

const app = require("../app");

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// Tiny cookie-keeping client
function client() {
  let cookie = "";

  const request = async function (url, { method = "GET", form, headers = {} } = {}) {
    const res = await fetch(base + url, {
      method,
      redirect: "manual",
      headers: {
        ...(cookie && { cookie }),
        ...(form && { "content-type": "application/x-www-form-urlencoded" }),
        ...headers,
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];

    return { status: res.status, location: res.headers.get("location"), headers: res.headers, text: await res.text() };
  };

  request.cookie = () => cookie;
  return request;
}

const user = {
  name: "Asha Verma",
  email: "Asha@Example.com",
  phone: "9876543210",
  password: "seva2026ok",
  confirmPassword: "seva2026ok",
  consent: "on",
};

// ------------------------------------------------------------
// Pages
// ------------------------------------------------------------

test("public pages render with navbar, footer and legal links", async () => {
  const get = client();

  for (const url of ["/", "/medical", "/donate", "/donation", "/login", "/register", "/admin/login"]) {
    const res = await get(url);
    assert.equal(res.status, 200, url);
    assert.match(res.text, /class="site-nav"/, `${url} navbar`);
    assert.match(res.text, /href="\/privacy-policy"/, `${url} footer`);
  }
});

test("legal pages exist and do not claim 80G approval", async () => {
  const get = client();

  for (const url of ["/terms", "/privacy-policy", "/refund-policy", "/disclaimer"]) {
    const res = await get(url);
    assert.equal(res.status, 200, url);
    assert.match(res.text, /Last updated/);
    assert.doesNotMatch(res.text, /80G (&amp; FCRA )?Certified|100% 80G eligible/i);
  }
});

test("homepage lists all five programmes and no Manorama branding", async () => {
  const res = await client()("/");

  for (const name of ["Green Earth", "Anand Dham", "Kanyadaan", "Vidya and Poshan", "Community Temple"]) {
    assert.match(res.text, new RegExp(name));
  }

  assert.doesNotMatch(res.text, /manorama/i);
});

test("unknown page returns styled 404", async () => {
  const res = await client()("/does-not-exist");
  assert.equal(res.status, 404);
  assert.match(res.text, /Page not found/);
});

test("security headers are set and x-powered-by is hidden", async () => {
  const res = await client()("/");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("donate page preselects the cause from the link", async () => {
  const res = await client()("/donate?cause=Anand%20Dham");
  assert.match(res.text, /<option value="Anand Dham" selected>/);
});

// ------------------------------------------------------------
// User accounts
// ------------------------------------------------------------

test("register rejects invalid input", async () => {
  const req = client();
  const cases = [
    [{ email: "bad" }, /valid email/],
    [{ phone: "12345" }, /10 digit mobile/],
    [{ password: "short1", confirmPassword: "short1" }, /at least 8/],
    [{ password: "onlyletters", confirmPassword: "onlyletters" }, /letter and one number/],
    [{ confirmPassword: "different1" }, /do not match/],
    [{ consent: "" }, /accept the Terms/],
  ];

  for (const [change, message] of cases) {
    const res = await req("/register", { method: "POST", form: { ...user, email: `x${Math.random()}@ex.com`, ...change } });
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.match(res.text, message);
  }
});

test("account page requires login", async () => {
  const res = await client()("/account");
  assert.equal(res.status, 302);
  assert.equal(res.location, "/login?next=%2Faccount");
});

test("full user journey: register, logout, login, change password", async () => {
  const req = client();

  let res = await req("/register", { method: "POST", form: user });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/account?welcome=1");

  res = await req("/account?welcome=1");
  assert.equal(res.status, 200);
  assert.match(res.text, /Namaste, Asha Verma/);
  assert.match(res.text, /asha@example.com/, "email stored lowercased");
  assert.match(res.text, /My Account/);

  // Same email in other case is a duplicate
  res = await client()("/register", { method: "POST", form: { ...user, email: "ASHA@example.com" } });
  assert.equal(res.status, 400);
  assert.match(res.text, /already exists/);

  res = await req("/logout", { method: "POST" });
  assert.equal(res.status, 302);
  res = await req("/account");
  assert.equal(res.status, 302, "logged out");

  res = await req("/login", { method: "POST", form: { email: user.email, password: "wrong-pass1" } });
  assert.equal(res.status, 401);
  assert.match(res.text, /Invalid email or password/);

  res = await req("/login", { method: "POST", form: { email: "asha@example.com", password: user.password, next: "/account" } });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/account");

  res = await req("/account/password", {
    method: "POST",
    form: { currentPassword: "nope", newPassword: "newpass123", confirmPassword: "newpass123" },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /Current password is incorrect/);

  res = await req("/account/password", {
    method: "POST",
    form: { currentPassword: user.password, newPassword: "newpass123", confirmPassword: "newpass123" },
  });
  assert.equal(res.status, 302);

  await req("/logout", { method: "POST" });

  res = await req("/login", { method: "POST", form: { email: user.email, password: user.password } });
  assert.equal(res.status, 401, "old password no longer works");

  res = await req("/login", { method: "POST", form: { email: user.email, password: "newpass123" } });
  assert.equal(res.status, 302, "new password works");
});

test("login ignores off-site redirect targets", async () => {
  const req = client();
  await req("/register", { method: "POST", form: { ...user, email: "redir@example.com" } });
  await req("/logout", { method: "POST" });

  const res = await req("/login", {
    method: "POST",
    form: { email: "redir@example.com", password: user.password, next: "//evil.example.com" },
  });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/account");
});

test("login session id changes after login (no session fixation)", async () => {
  const req = client();
  await req("/register", { method: "POST", form: { ...user, email: "fixation@example.com" } });
  await req("/logout", { method: "POST" });
  const before = req.cookie();
  assert.ok(before, "anonymous session exists");

  const res = await req("/login", { method: "POST", form: { email: "fixation@example.com", password: user.password } });
  assert.equal(res.status, 302);
  assert.notEqual(req.cookie(), before, "session id rotated");
});

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

test("admin dashboard requires login", async () => {
  const res = await client()("/admin/dashboard");
  assert.equal(res.status, 302);
  assert.equal(res.location, "/admin/login");
});

test("admin login: wrong password rejected, right password opens dashboard", async () => {
  const req = client();

  let res = await req("/admin/login", { method: "POST", form: { password: "wrong" } });
  assert.equal(res.status, 401);
  assert.match(res.text, /Invalid admin password/);

  res = await req("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/admin/dashboard");

  res = await req("/admin/dashboard");
  assert.equal(res.status, 200);
  assert.match(res.text, /Registered Users/);

  res = await req("/admin/logout", { method: "POST" });
  assert.equal(res.status, 302);
  res = await req("/admin/dashboard");
  assert.equal(res.status, 302, "logged out");
});

// ------------------------------------------------------------
// Medical help form
// ------------------------------------------------------------

const medical = {
  patientName: "Ram Prasad",
  aadharNumber: "123412341234",
  dateBirth: "1960-05-10",
  patientPhoneNumber: "9123456780",
  patientEmail: "asha@example.com",
  nameDiseases: "Cataract",
  hospitalName: "District Hospital Basti",
  consent: "on",
};

test("medical form validates input and escapes error output", async () => {
  const req = client();
  const cases = [
    [{ aadharNumber: "1234" }, /12 digits/],
    [{ patientPhoneNumber: "1234567890" }, /10 digits/],
    [{ dateBirth: "2999-01-01" }, /valid date of birth/],
    [{ dateBirth: "2020-02-30" }, /valid date of birth/],
    [{ consent: "" }, /accept the Terms/],
    [{ hospitalName: "x".repeat(200) }, /too long/],
  ];

  for (const [change, message] of cases) {
    const res = await req("/medical", { method: "POST", form: { ...medical, ...change } });
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.match(res.text, message);
  }

  const res = await req("/medical", { method: "POST", form: { ...medical, patientName: "<script>alert(1)</script>", aadharNumber: "" } });
  assert.equal(res.status, 400);
  assert.doesNotMatch(res.text, /<script>alert/);
});

test("medical request is saved with an unguessable reference and shows in account", async () => {
  const req = client();

  let res = await req("/medical", { method: "POST", form: medical });
  assert.equal(res.status, 302);
  const reference = new URL(res.location, base).searchParams.get("reference");
  assert.match(reference, /^MED-\d+-[0-9A-F]{8}$/);

  res = await req(`/medical/receipt/Medical-Help-Receipt-${reference}.pdf`);
  assert.equal(res.status, 200);

  res = await req("/login", { method: "POST", form: { email: user.email, password: "newpass123" } });
  assert.equal(res.status, 302);

  res = await req("/account");
  assert.match(res.text, new RegExp(reference));
  assert.match(res.text, /Cataract/);
});

// ------------------------------------------------------------
// Donation (PayU) flow
// ------------------------------------------------------------

const donation = {
  cause: "Green Earth",
  donorName: "Asha Verma",
  phoneNumber: "9876543210",
  email: "asha@example.com",
  amount: "1100",
  paymentMode: "UPI",
  consent: "on",
};

test("donation form requires consent and a valid amount", async () => {
  const req = client();

  let res = await req("/donate", { method: "POST", form: { ...donation, consent: "" } });
  assert.equal(res.status, 400);
  assert.match(res.text, /accept the Terms/);

  res = await req("/donate", { method: "POST", form: { ...donation, amount: "50" } });
  assert.equal(res.status, 400);
  assert.match(res.text, /Minimum donation/);
});

test("verified PayU donation is saved with its cause and listed in the account", async () => {
  const req = client();

  let res = await req("/donate", { method: "POST", form: donation });
  assert.equal(res.status, 200);

  const field = (name) => res.text.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`))?.[1] ?? "";
  const txnid = field("txnid");
  assert.ok(txnid, "payment form has txnid");
  assert.equal(field("udf4"), "Green Earth", "cause signed into PayU request");

  // Build the callback PayU would send back
  const callback = {
    key: "testkey",
    txnid,
    amount: field("amount"),
    productinfo: field("productinfo"),
    firstname: field("firstname"),
    email: field("email"),
    udf1: field("udf1"),
    udf2: field("udf2"),
    udf3: field("udf3"),
    udf4: field("udf4"),
    udf5: field("udf5"),
    status: "success",
    mihpayid: "PAYU123",
  };
  const reverse = `testsalt|success||||||${callback.udf5}|${callback.udf4}|${callback.udf3}|${callback.udf2}|${callback.udf1}|${callback.email}|${callback.firstname}|${callback.productinfo}|${callback.amount}|${txnid}|testkey`;
  callback.hash = crypto.createHash("sha512").update(reverse).digest("hex");

  // Tampered hash is rejected
  res = await req("/donate/success", { method: "POST", form: { ...callback, hash: "0".repeat(128) } });
  assert.notEqual(res.status, 200);

  res = await req("/donate/success", { method: "POST", form: callback });
  assert.equal(res.status, 200, res.text.slice(0, 300));

  res = await req("/login", { method: "POST", form: { email: user.email, password: "newpass123" } });
  res = await req("/account");
  assert.match(res.text, new RegExp(txnid));
  assert.match(res.text, /Green Earth/);
  assert.match(res.text, /₹1,100/);
});

// ------------------------------------------------------------
// Rate limiting (last: it blocks this IP for the rest of the run)
// ------------------------------------------------------------

test("too many failed logins are blocked with 429", async () => {
  const req = client();
  let res;

  for (let i = 0; i < 6; i += 1) {
    res = await req("/login", { method: "POST", form: { email: "nobody@example.com", password: "wrong-pass1" } });
  }

  assert.equal(res.status, 429);
  assert.match(res.text, /Too many failed attempts/);
});
