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
  PAYU_SUCCESS_URL: "http://localhost/donation/success",
  PAYU_FAILURE_URL: "http://localhost/donation/failure",
  PAYU_DONATION_SUCCESS_URL: "http://localhost/donate/success",
  PAYU_DONATION_FAILURE_URL: "http://localhost/donate/failure",
  EMAIL_USER: "",
  EMAIL_PASS: "",
  // Never the database in .env (dotenv does not override keys already set,
  // even empty ones); npm run test:mongo passes a temporary one
  MONGODB_URI: process.env.TEST_MONGODB_URI || "",
  MONGODB_DB: "jbc_test",
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

  const request = async function (
    url,
    { method = "GET", form, multipart, headers = {} } = {},
  ) {
    const res = await fetch(base + url, {
      method,
      redirect: "manual",
      headers: {
        ...(cookie && { cookie }),
        ...(form && { "content-type": "application/x-www-form-urlencoded" }),
        ...headers,
      },
      body: multipart || (form ? new URLSearchParams(form).toString() : undefined),
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];

    return {
      status: res.status,
      location: res.headers.get("location"),
      headers: res.headers,
      text: await res.text(),
    };
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

  for (const url of [
    "/",
    "/medical",
    "/donate",
    "/donation",
    "/login",
    "/register",
    "/admin/login",
    "/volunteer",
    "/contact",
  ]) {
    const res = await get(url);
    assert.equal(res.status, 200, url);
    assert.match(res.text, /class="site-nav"/, `${url} navbar`);
    assert.match(res.text, /href="\/privacy-policy"/, `${url} footer`);
    assert.match(res.text, /href="https:\/\/wa\.me\/919648191111/, `${url} WhatsApp`);
    assert.match(res.text, /mailto:jbcsevatrust@gmail\.com/, `${url} email`);
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

  for (const name of [
    "Green Earth",
    "Anand Dham",
    "Kanyadaan",
    "Vidya and Poshan",
    "Community Temple",
  ]) {
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

test("donate page lists every cause and old ?cause= links redirect", async () => {
  const get = client();
  const trust = require("../config/trustConfig");

  const res = await get("/donate");
  for (const p of trust.donationPages) {
    assert.match(res.text, new RegExp(`href="/donate/${p.slug}"`));
  }

  let redirect = await get("/donate?cause=Anand%20Dham");
  assert.equal(redirect.status, 302);
  assert.equal(redirect.location, "/donate/anand-dham");

  redirect = await get("/donate?cause=Green%20Earth&amount=2100");
  assert.equal(redirect.location, "/donate/green-earth?amount=2100");

  const page = await get("/donate/green-earth?amount=2100");
  assert.match(page.text, /value="2100"/, "amount carried over");

  const bad = await get("/donate/green-earth?amount=%22%3E%3Cscript%3E");
  assert.doesNotMatch(bad.text, /<script>/);

  assert.equal((await get("/donate/unknown")).status, 404);
});

test("each cause page shows only its own options", async () => {
  const get = client();

  const temple = await get("/donate/temple");
  assert.match(temple.text, /Daily aarti and bhog/);
  assert.match(temple.text, /name="gotra"/);
  assert.match(temple.text, /name="sevaDate"/);
  assert.match(temple.text, /not eligible for 80G/);

  const green = await get("/donate/green-earth");
  assert.match(green.text, /Tree plantation/);
  assert.doesNotMatch(green.text, /name="gotra"/);
  assert.doesNotMatch(green.text, /name="sevaDate"/);

  const elders = await get("/donate/anand-dham");
  assert.match(elders.text, /Meals for elders/);
  assert.match(elders.text, /name="sevaDate"/);
});

test("every programme has its own page, unknown ones 404", async () => {
  const get = client();
  const trust = require("../config/trustConfig");

  for (const p of trust.programmes) {
    const res = await get(`/work/${p.slug}`);
    assert.equal(res.status, 200, p.slug);
    assert.match(res.text, new RegExp(`<h1>${p.title}</h1>`));
    assert.match(res.text, new RegExp(`href="/donate/${p.slug}"`));
  }

  assert.equal((await get("/work/unknown")).status, 404);
});

// ------------------------------------------------------------
// Volunteer + contact
// ------------------------------------------------------------

const volunteer = {
  name: "Ravi Kumar",
  phone: "9812345678",
  email: "ravi@example.com",
  city: "Basti",
  areas: "Tree plantation",
  availability: "Weekends",
  consent: "on",
};

const message = {
  enquiryType: "CSR or major donation",
  name: "Meena Gupta",
  organisation: "Example Industries",
  phone: "9898989898",
  email: "meena@example.com",
  message: "We would like to fund a plantation drive.",
  consent: "on",
};

test("volunteer form validates and saves", async () => {
  const req = client();
  const cases = [
    [{ areas: "" }, /at least one area/],
    [{ areas: "Hacking" }, /at least one area/],
    [{ availability: "Never" }, /when you are available/],
    [{ city: "" }, /Village \/ city is required/],
    [{ phone: "123" }, /10 digit mobile/],
    [{ consent: "" }, /accept the Terms/],
  ];

  for (const [change, msg] of cases) {
    const res = await req("/volunteer", {
      method: "POST",
      form: { ...volunteer, ...change },
    });
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.match(res.text, msg);
    assert.match(res.text, /value="Ravi Kumar"/, "typed values kept");
  }

  const res = await req("/volunteer", { method: "POST", form: volunteer });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/volunteer?done=1");
  assert.match((await req(res.location)).text, /Thank you for registering/);
});

test("contact form validates and saves", async () => {
  const req = client();

  let res = await req("/contact", { method: "POST", form: { ...message, message: "" } });
  assert.equal(res.status, 400);
  assert.match(res.text, /Message is required/);

  res = await req("/contact", {
    method: "POST",
    form: { ...message, enquiryType: "Spam" },
  });
  assert.equal(res.status, 400);

  res = await req("/contact", { method: "POST", form: message });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/contact?done=1");

  res = await req("/contact?type=csr");
  assert.match(res.text, /<option value="CSR or major donation" selected>/);
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
    [
      { password: "onlyletters", confirmPassword: "onlyletters" },
      /letter and one number/,
    ],
    [{ confirmPassword: "different1" }, /do not match/],
    [{ consent: "" }, /accept the Terms/],
  ];

  for (const [change, message] of cases) {
    const res = await req("/register", {
      method: "POST",
      form: { ...user, email: `x${Math.random()}@ex.com`, ...change },
    });
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
  assert.match(
    res.text,
    /Please confirm your email/,
    "records hidden until the email is confirmed",
  );

  const verifyToken =
    await require("../services/userAuthService").requestEmailVerification(user.email);
  res = await req(`/verify-email/${verifyToken}`);
  assert.equal(res.location, "/account?verify=done");
  res = await req("/account?verify=done");
  assert.match(res.text, /Your email is confirmed/);
  assert.match(res.text, /asha@example.com/, "email stored lowercased");
  assert.match(res.text, /My Account/);

  // Same email in other case is a duplicate
  res = await client()("/register", {
    method: "POST",
    form: { ...user, email: "ASHA@example.com" },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /already exists/);

  res = await req("/logout", { method: "POST" });
  assert.equal(res.status, 302);
  res = await req("/account");
  assert.equal(res.status, 302, "logged out");

  res = await req("/login", {
    method: "POST",
    form: { email: user.email, password: "wrong-pass1" },
  });
  assert.equal(res.status, 401);
  assert.match(res.text, /Invalid email or password/);

  res = await req("/login", {
    method: "POST",
    form: { email: "asha@example.com", password: user.password, next: "/account" },
  });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/account");

  res = await req("/account/password", {
    method: "POST",
    form: {
      currentPassword: "nope",
      newPassword: "newpass123",
      confirmPassword: "newpass123",
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /Current password is incorrect/);

  // A second session (say, someone else who knew the old password)
  const other = client();
  await other("/login", {
    method: "POST",
    form: { email: user.email, password: user.password },
  });
  assert.equal((await other("/account")).status, 200);

  res = await req("/account/password", {
    method: "POST",
    form: {
      currentPassword: user.password,
      newPassword: "newpass123",
      confirmPassword: "newpass123",
    },
  });
  assert.equal(res.status, 302);
  assert.equal((await req("/account")).status, 200, "this session stays logged in");
  assert.equal((await other("/account")).status, 302, "older session is logged out");
  assert.doesNotMatch(
    (await other("/contact")).text,
    /asha@example\.com/,
    "and its forms are no longer pre-filled with the owner's details",
  );

  await req("/logout", { method: "POST" });

  res = await req("/login", {
    method: "POST",
    form: { email: user.email, password: user.password },
  });
  assert.equal(res.status, 401, "old password no longer works");

  res = await req("/login", {
    method: "POST",
    form: { email: user.email, password: "newpass123" },
  });
  assert.equal(res.status, 302, "new password works");
});

test("forgot password: same answer for unknown email, link resets password once", async () => {
  const req = client();
  const userAuthService = require("../services/userAuthService");
  await req("/register", {
    method: "POST",
    form: { ...user, email: "reset@example.com" },
  });
  await req("/logout", { method: "POST" });

  let res = await req("/forgot-password", {
    method: "POST",
    form: { email: "nobody-here@example.com" },
  });
  assert.equal(res.status, 200);
  assert.match(res.text, /If an account exists/);

  res = await req("/forgot-password", {
    method: "POST",
    form: { email: "reset@example.com" },
  });
  assert.match(res.text, /If an account exists/);

  const token = await userAuthService.requestPasswordReset("reset@example.com");
  assert.match(token, /^[a-f0-9]{64}$/);

  assert.equal(
    (await req("/reset-password/" + "0".repeat(64))).status,
    400,
    "unknown token",
  );

  res = await req(`/reset-password/${token}`, {
    method: "POST",
    form: { password: "short", confirmPassword: "short" },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /at least 8/);

  res = await req(`/reset-password/${token}`, {
    method: "POST",
    form: { password: "fresh2026pw", confirmPassword: "fresh2026pw" },
  });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/login?reset=1");

  res = await req(`/reset-password/${token}`, {
    method: "POST",
    form: { password: "again2026pw", confirmPassword: "again2026pw" },
  });
  assert.equal(res.status, 400, "link works only once");

  res = await req("/login", {
    method: "POST",
    form: { email: "reset@example.com", password: "fresh2026pw" },
  });
  assert.equal(res.status, 302, "new password works");
});

test("someone registering with another person's email cannot see their records", async () => {
  // A medical request and a donation exist for victim@example.com
  const victim = client();
  await victim("/medical", {
    method: "POST",
    form: {
      ...medical,
      patientEmail: "victim@example.com",
      aadharNumber: "999988887779",
    },
  });

  const attacker = client();
  let res = await attacker("/register", {
    method: "POST",
    form: { ...user, name: "Someone Else", email: "victim@example.com" },
  });
  assert.equal(res.status, 302);

  res = await attacker("/account");
  assert.match(res.text, /Please confirm your email/);
  assert.doesNotMatch(res.text, /Cataract/, "medical details stay hidden");
  assert.equal(
    (await attacker("/verify-email/" + "f".repeat(64))).status,
    400,
    "a made-up link does not verify",
  );

  // The real owner's link, opened while not logged in to that account
  // (their own browser, or a mail scanner), does not confirm it
  const ownerLink = await require("../services/userAuthService").requestEmailVerification(
    "victim@example.com",
  );
  res = await client()(`/verify-email/${ownerLink}`);
  assert.match(res.location, /^\/login\?next=/, "asks to log in to that account");
  assert.equal(
    (await require("../models/userModel").findByEmail("victim@example.com"))
      .emailVerified,
    false,
  );
});

test("login ignores off-site redirect targets", async () => {
  const req = client();
  await req("/register", {
    method: "POST",
    form: { ...user, email: "redir@example.com" },
  });
  await req("/logout", { method: "POST" });

  const res = await req("/login", {
    method: "POST",
    form: {
      email: "redir@example.com",
      password: user.password,
      next: "//evil.example.com",
    },
  });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/account");
});

test("login session id changes after login (no session fixation)", async () => {
  const req = client();
  await req("/register", {
    method: "POST",
    form: { ...user, email: "fixation@example.com" },
  });
  await req("/logout", { method: "POST" });
  const before = req.cookie();
  assert.ok(before, "anonymous session exists");

  const res = await req("/login", {
    method: "POST",
    form: { email: "fixation@example.com", password: user.password },
  });
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
  assert.match(res.text, /Registered users/);
  assert.match(
    (await req("/admin/dashboard?view=volunteers")).text,
    /Ravi Kumar/,
    "volunteer listed",
  );
  assert.match(
    (await req("/admin/dashboard?view=messages")).text,
    /Example Industries/,
    "message listed",
  );
  assert.match(
    (await req("/admin/dashboard?view=messages&q=nomatch")).text,
    /0 record\(s\)/,
    "server-side search",
  );

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
  aadharNumber: "234123412346",
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
    const res = await req("/medical", {
      method: "POST",
      form: { ...medical, ...change },
    });
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.match(res.text, message);
  }

  const res = await req("/medical", {
    method: "POST",
    form: { ...medical, patientName: "<script>alert(1)</script>", aadharNumber: "" },
  });
  assert.equal(res.status, 400);
  assert.doesNotMatch(res.text, /<script>alert/);

  // The form comes back filled in, with a readable message
  const kept = await req("/medical", {
    method: "POST",
    form: { ...medical, hospitalName: "" },
  });
  assert.equal(kept.status, 400);
  assert.match(kept.text, /Hospital name is required/);
  assert.match(kept.text, /value="Ram Prasad"/);
  assert.match(kept.text, /value="Cataract"/);

  // Typed text is not translated in Hindi mode
  const hindi = await req("/contact", {
    method: "POST",
    headers: { cookie: "lang=hi" },
    form: {
      name: "Asha",
      phone: "9876543210",
      email: "a@example.com",
      message: "Support for medicine",
      enquiryType: "",
      consent: "on",
    },
  });
  assert.match(hindi.text, /Support for medicine<\/textarea>/);
});

test("medical request is saved with an unguessable reference and shows in account", async () => {
  const req = client();

  let res = await req("/medical", { method: "POST", form: medical });
  assert.equal(res.status, 302);
  const reference = new URL(res.location, base).searchParams.get("reference");
  assert.match(reference, /^MED-\d+-[0-9A-F]{8}$/);

  const file = new URL(res.location, base).searchParams.get("file");
  assert.match(file, /^Medical-Help-Receipt-MED-\d+-[0-9A-F]{8}-[0-9a-f]{32}\.pdf$/);

  res = await req(`/medical/receipt/Medical-Help-Receipt-${reference}.pdf`);
  assert.equal(res.status, 404, "the reference alone does not open the receipt");

  res = await req(`/medical/receipt/${file}`);
  assert.equal(res.status, 200);

  res = await req("/login", {
    method: "POST",
    form: { email: user.email, password: "newpass123" },
  });
  assert.equal(res.status, 302);

  res = await req("/account");
  assert.match(res.text, new RegExp(reference));
  assert.match(res.text, /Cataract/);
  assert.match(res.text, new RegExp(file), "account links to the private receipt");
});

// ------------------------------------------------------------
// Donation (PayU) flow
// ------------------------------------------------------------

const donation = {
  cause: "Green Earth",
  purpose: "Tree plantation",
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
  assert.match(res.text, /value="Asha Verma"/, "form is shown again with typed values");
});

test("donation details are checked against the chosen cause", async () => {
  const req = client();
  const future = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const cases = [
    [{ purpose: "Daily aarti and bhog" }, /choose what your donation for Green Earth/],
    [{ purpose: "" }, /choose what your donation/],
    [{ pan: "ABC123" }, /valid 10 character PAN/],
    [{ dedicationType: "In memory of", dedicatedTo: "" }, /enter the name or occasion/],
    [{ dedicationType: "Bogus", dedicatedTo: "x" }, /valid dedication/],
    [
      {
        cause: "Community Temple",
        purpose: "Prasad distribution",
        sevaDate: "2001-01-01",
      },
      /within the next year/,
    ],
    [
      {
        cause: "Community Temple",
        purpose: "Prasad distribution",
        sevaDate: "2999-01-01",
      },
      /within the next year/,
    ],
  ];

  for (const [change, msg] of cases) {
    const res = await req("/donate", {
      method: "POST",
      form: { ...donation, ...change },
    });
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.match(res.text, msg);
  }

  // Temple-only fields are ignored for other causes
  const res = await req("/donate", {
    method: "POST",
    form: { ...donation, sevaDate: future, gotra: "Kashyap" },
  });
  assert.equal(res.status, 200);
});

test("verified PayU donation is saved with its cause and listed in the account", async () => {
  const req = client();

  let res = await req("/donate", { method: "POST", form: donation });
  assert.equal(res.status, 200);

  const field = (name) =>
    res.text.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`))?.[1] ?? "";
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
  res = await req("/donate/success", {
    method: "POST",
    form: { ...callback, hash: "0".repeat(128) },
  });
  assert.notEqual(res.status, 200);

  // A signed donation posted to the membership callback is not saved as a membership
  res = await req("/donation/success", { method: "POST", form: callback });
  assert.equal(res.status, 400, "donation refused by membership callback");
  assert.equal(callback.udf3, "", "free-text message is not sent to PayU");

  res = await req("/donate/success", { method: "POST", form: callback });
  assert.equal(res.status, 303, "redirects after saving, so a refresh never re-posts");
  assert.equal(res.location, `/donate/thank-you/${txnid}`);

  res = await req(res.location);
  assert.equal(res.status, 200);
  assert.match(res.text, /Your donation to Green Earth has been received/);

  // PayU posting the same callback again does not create a second record
  res = await req("/donate/success", { method: "POST", form: callback });
  assert.equal(res.status, 303);

  res = await req("/login", {
    method: "POST",
    form: { email: user.email, password: "newpass123" },
  });
  res = await req("/account");
  assert.match(res.text, new RegExp(txnid));
  assert.match(res.text, /Green Earth/);
  assert.match(res.text, /₹1,100/);
});

// Starts a donation and returns the signed callback PayU would send back
async function startDonation(req, form) {
  const res = await req("/donate", { method: "POST", form });
  assert.equal(res.status, 200, res.text.slice(0, 300));

  const field = (name) =>
    res.text.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`))?.[1] ?? "";
  const callback = { key: "testkey", status: "success", mihpayid: "PAYU" + Date.now() };
  for (const name of [
    "txnid",
    "amount",
    "productinfo",
    "firstname",
    "email",
    "udf1",
    "udf2",
    "udf3",
    "udf4",
    "udf5",
  ]) {
    callback[name] = field(name);
  }

  const reverse = `testsalt|success||||||${callback.udf5}|${callback.udf4}|${callback.udf3}|${callback.udf2}|${callback.udf1}|${callback.email}|${callback.firstname}|${callback.productinfo}|${callback.amount}|${callback.txnid}|testkey`;
  callback.hash = crypto.createHash("sha512").update(reverse).digest("hex");
  return callback;
}

test("temple donation keeps purpose, dedication, seva date and gotra end to end", async () => {
  const req = client();
  const sevaDate = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  const callback = await startDonation(req, {
    ...donation,
    cause: "Community Temple",
    purpose: "Daily aarti and bhog",
    amount: "501",
    dedicationType: "In memory of",
    dedicatedTo: "Late Shri Ram Prasad",
    sevaDate,
    gotra: "Kashyap",
    pan: "abcde1234f",
  });

  assert.equal(callback.udf4, "Community Temple");
  assert.equal(callback.udf5, "Daily aarti and bhog", "purpose signed into PayU request");

  let res = await req("/donate/success", { method: "POST", form: callback });
  assert.equal(res.status, 303);
  res = await req(res.location);
  assert.equal(res.status, 200, res.text.slice(0, 300));
  assert.match(res.text, /Your donation to Community Temple has been received/);
  assert.match(res.text, /In memory of Late Shri Ram Prasad/);
  assert.match(
    res.text,
    /https:\/\/wa\.me\/\?text=[^"]*donate%2Fcertificate%2F/,
    "WhatsApp receipt link",
  );
  assert.match(res.text, /donate%2Ftemple/, "share link points to the temple page");
  assert.match(res.text, new RegExp(sevaDate));

  const certificate = await req(`/donate/certificate/${callback.txnid}`);
  assert.equal(certificate.status, 200);
  assert.match(certificate.headers.get("content-type"), /pdf/);

  await req("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });
  res = await req("/admin/dashboard");
  assert.match(res.text, /Fund-wise collection/);
  assert.match(res.text, /Gotra: Kashyap/);
  assert.match(res.text, /PAN: ABCDE1234F/, "PAN stored uppercased");
  assert.match(
    res.text,
    /<td><strong>Community Temple<\/strong><\/td>\s*<td>1<\/td>\s*<td>₹501<\/td>/,
  );

  // CSV exports
  res = await req("/admin/export/donations");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  assert.match(res.text, /Late Shri Ram Prasad/);
  assert.match(res.text, /ABCDE1234F/);

  res = await req("/admin/export/funds");
  assert.match(res.text, /Community Temple,1,501/);

  res = await req("/admin/export/medical");
  assert.match(res.text, /XXXX-XXXX-2346/);
  assert.doesNotMatch(res.text, /234123412346/, "full Aadhaar never exported");

  assert.equal((await req("/admin/export/unknown")).status, 404);
  assert.equal(
    (await client()("/admin/export/donations")).status,
    302,
    "needs admin login",
  );
});

test("Form 10BD export lists charitable donors by PAN, never temple gifts", async () => {
  const req = client();
  for (const amount of ["1000", "500"]) {
    const callback = await startDonation(req, {
      ...donation,
      amount,
      pan: "PQRSX6789K",
      address: "Village Mudila, Basti",
    });
    assert.equal(
      (await req("/donate/success", { method: "POST", form: callback })).status,
      303,
    );
  }

  const admin = client();
  await admin("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });
  assert.equal(
    (await admin("/admin/export/form-10bd")).status,
    404,
    "hidden until 80G approval",
  );

  const { eightyG } = require("../config/trustConfig");
  eightyG.approved = true;
  const res = await admin("/admin/export/form-10bd");
  eightyG.approved = false;
  assert.match(res.text, /PQRSX6789K/);
  assert.match(res.text, /Village Mudila, Basti/);
  assert.match(res.text, /,1500\r\n/, "two gifts from one PAN are added up");
  assert.doesNotMatch(res.text, /ABCDE1234F/, "temple donor excluded");
});

test("tax note claims 80G only after approval, never for the temple", () => {
  const trust = require("../config/trustConfig");
  assert.match(
    trust.taxNote("Green Earth"),
    /only after the Trust receives 80G approval/,
  );

  Object.assign(trust.eightyG, {
    approved: true,
    registrationNumber: "URN123",
    validFrom: "2026-27",
    validTo: "2030-31",
    trustPan: "AAATJ0000X",
  });
  try {
    assert.match(
      trust.taxNote("Green Earth"),
      /Eligible for deduction under Section 80G.*URN123/,
    );
    assert.match(trust.taxNote("Community Temple"), /not eligible for 80G/);
  } finally {
    trust.eightyG.approved = false;
  }
});

test("monthly donation: pledge, one reminder a month, stop from account", async () => {
  const pledgeService = require("../services/pledgeService");
  const req = client();
  await req("/register", {
    method: "POST",
    form: { ...user, email: "monthly@example.com" },
  });

  const token = await require("../services/userAuthService").requestEmailVerification(
    "monthly@example.com",
  );
  await req(`/verify-email/${token}`);

  const callback = await startDonation(req, {
    ...donation,
    email: "monthly@example.com",
    cause: "Anand Dham",
    purpose: "Meals for elders (annadaan)",
    amount: "1100",
    monthly: "on",
  });
  assert.equal(
    (await req("/donate/success", { method: "POST", form: callback })).status,
    303,
  );

  let res = await req("/account");
  assert.match(res.text, /Monthly donations/);
  assert.match(res.text, /Meals for elders/);

  const [pledge] = await pledgeService.pledgesFor("monthly@example.com");
  assert.match(
    pledgeService.payLink(pledge),
    /\/donate\/anand-dham\?amount=1100&monthly=1&purpose=Meals/,
  );

  const page = await req(
    "/donate/anand-dham?amount=1100&monthly=1&purpose=Meals+for+elders+%28annadaan%29",
  );
  assert.match(page.text, /name="monthly" checked/);
  assert.match(page.text, /value="Meals for elders \(annadaan\)" checked/);

  const now = Date.now();
  assert.equal(pledgeService.isDue(pledge, now), false, "not due right after paying");

  const month = now + 31 * 864e5;
  assert.equal(await pledgeService.sendDueReminders(month), 1);
  assert.equal(
    await pledgeService.sendDueReminders(month + 864e5),
    0,
    "only one reminder per month",
  );

  // A one-off gift to the same cause counts as this month's payment
  const oneOff = {
    ...donation,
    email: "monthly@example.com",
    cause: "Anand Dham",
    purpose: "Meals for elders (annadaan)",
    amount: "1100",
  };
  await req("/donate/success", {
    method: "POST",
    form: await startDonation(req, oneOff),
  });
  const [afterOneOff] = await pledgeService.pledgesFor("monthly@example.com");
  assert.ok(
    new Date(afterOneOff.lastPaid) > new Date(pledge.lastPaid),
    "one-off gift moves the next reminder",
  );

  // The reminder email's stop link works without logging in
  const link = new URL(pledgeService.stopLink(pledge));
  const guest = client();
  res = await guest(
    `/monthly/stop?k=${encodeURIComponent(link.searchParams.get("k"))}&t=bad`,
  );
  assert.equal(res.status, 400, "a forged link is refused");
  res = await guest(link.pathname + link.search);
  assert.match(res.text, /Stop monthly reminders\?/, "opening the link only asks");
  assert.equal((await pledgeService.pledgesFor("monthly@example.com")).length, 1);
  res = await guest("/monthly/stop", {
    method: "POST",
    form: { k: link.searchParams.get("k"), t: link.searchParams.get("t") },
  });
  assert.match(res.text, /Monthly reminders stopped/);
  assert.equal((await pledgeService.pledgesFor("monthly@example.com")).length, 0);

  res = await req("/account/pledges/stop", {
    method: "POST",
    form: { cause: "Anand Dham" },
  });
  assert.equal(res.status, 302);
  res = await req("/account?pledge=stopped");
  assert.match(res.text, /has been stopped/);
  assert.doesNotMatch(res.text, /Monthly donations/);
  assert.equal(
    await pledgeService.sendDueReminders(month + 62 * 864e5),
    0,
    "stopped pledges get no reminders",
  );

  // A later one-off gift does not restart stopped reminders
  await req("/donate/success", {
    method: "POST",
    form: await startDonation(req, oneOff),
  });
  assert.equal((await pledgeService.pledgesFor("monthly@example.com")).length, 0);
});

test("backup copies the data files", async () => {
  const { runBackup } = require("../services/backupService");
  const target = await runBackup();
  const files = fs.readdirSync(target);
  assert.ok(files.includes("donations.txt"), files.join(","));
  assert.ok(files.includes("accounts.txt"));

  // Photos and medical receipts are backed up; unchanged ones are linked
  // to the previous backup instead of copied again
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "receipts"), { recursive: true });
  fs.writeFileSync(path.join(dataDir, "uploads", "a".repeat(32) + ".jpg"), "photo");
  fs.writeFileSync(
    path.join(dataDir, "receipts", "Medical-Help-Receipt-MED-1.pdf"),
    "pdf",
  );
  fs.writeFileSync(
    path.join(dataDir, "receipts", "donation-certificate-TXN_1.pdf"),
    "pdf",
  );
  const first = await runBackup();
  const earlier = path.join(path.dirname(first), "0000-earlier");
  fs.renameSync(first, earlier);
  const second = await runBackup();

  const photo = (dir) => fs.statSync(path.join(dir, "uploads", "a".repeat(32) + ".jpg"));
  assert.equal(photo(second).ino, photo(earlier).ino, "photo linked, not copied");
  assert.ok(
    fs.existsSync(path.join(second, "receipts", "Medical-Help-Receipt-MED-1.pdf")),
  );
  assert.ok(
    !fs.existsSync(path.join(second, "receipts", "donation-certificate-TXN_1.pdf")),
    "donation certificates are made again on download, not backed up",
  );

  const req = client();
  await req("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });
  const res = await req("/admin/dashboard");
  assert.doesNotMatch(res.text, /Go-live checklist/, "checklist is not shown to admins");
  assert.doesNotMatch(res.text, /testsalt/, "secret values are never shown");
});

test("admin posts updates with photos and events; public can register", async () => {
  const admin = client();
  await admin("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });

  // 1x1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  const updateForm = (file, type) => {
    const fd = new FormData();
    fd.append("form", "update");
    fd.append("title", "120 neem saplings planted");
    fd.append("programme", "green-earth");
    fd.append("body", "Planted with students of the village school.");
    if (file) fd.append("photo", new Blob([file], { type }), "photo.png");
    return fd;
  };

  // A text file pretending to be a PNG is refused
  let res = await admin("/admin/updates", {
    method: "POST",
    multipart: updateForm(Buffer.from("not an image"), "image/png"),
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /Only JPG, PNG or WebP/);

  res = await admin("/admin/updates", {
    method: "POST",
    multipart: updateForm(png, "image/png"),
  });
  assert.equal(res.status, 302);

  res = await admin("/admin/content");
  const photo = res.text.match(/\/uploads\/([a-f0-9]{32}\.png)/)?.[1];
  assert.ok(photo, "photo stored with a random name");

  const pub = client();
  res = await pub(`/uploads/${photo}`);
  assert.equal(res.status, 200);
  assert.equal((await pub("/uploads/..%2Fdonations.txt")).status, 404, "no path tricks");

  assert.match((await pub("/")).text, /120 neem saplings planted/, "shown on home");
  assert.match(
    (await pub("/work/green-earth")).text,
    /120 neem saplings planted/,
    "shown on programme page",
  );
  assert.match(
    (await pub("/updates?programme=green-earth")).text,
    /120 neem saplings planted/,
  );
  assert.doesNotMatch(
    (await pub("/updates?programme=temple")).text,
    /120 neem saplings planted/,
  );

  // Events
  const soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  res = await admin("/admin/events", {
    method: "POST",
    form: {
      form: "event",
      title: "Eye camp",
      date: "2001-01-01",
      place: "Basti",
      description: "Free eye check-up",
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /cannot be in the past/);

  res = await admin("/admin/events", {
    method: "POST",
    form: {
      form: "event",
      title: "Eye camp",
      date: soon,
      time: "09:00",
      place: "Anand Dham, Basti",
      programme: "anand-dham",
      description: "Free eye check-up and spectacles",
      volunteersNeeded: "on",
    },
  });
  assert.equal(res.status, 302);

  res = await pub("/events");
  assert.match(res.text, /Eye camp/);
  assert.match(res.text, /Volunteers needed/);
  const eventId = res.text.match(/href="\/events\/([0-9a-f-]{36})"/)[1];

  const reg = {
    name: "Sunita Devi",
    phone: "9012345678",
    email: "sunita@example.com",
    people: "2",
    role: "Volunteer",
    consent: "on",
  };
  res = await pub(`/events/${eventId}/register`, {
    method: "POST",
    form: { ...reg, people: "50" },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /between 1 and 20/);

  res = await pub(`/events/${eventId}/register`, { method: "POST", form: reg });
  assert.equal(res.status, 302);
  assert.match((await pub(`/events/${eventId}?done=1`)).text, /You are registered/);

  res = await admin("/admin/content");
  assert.match(res.text, /2 people \(1 volunteers\)/);
  assert.match((await admin("/admin/export/event-registrations")).text, /Sunita Devi/);

  // Delete removes the update everywhere
  const updateId = res.text.match(/\/admin\/updates\/([0-9a-f-]{36})\/delete/)[1];
  await admin(`/admin/updates/${updateId}/delete`, { method: "POST" });
  assert.doesNotMatch((await pub("/updates")).text, /120 neem saplings planted/);
  assert.equal((await pub(`/uploads/${photo}`)).status, 404, "its photo is removed too");

  assert.equal((await pub("/admin/content")).status, 302, "admin only");
});

test("Hindi version: switch, translated pages, English form values, admin stays English", async () => {
  const req = client();

  let res = await req("/?lang=hi");
  assert.match(res.headers.get("set-cookie") || "", /lang=hi/);
  assert.match(res.text, /<html lang="hi">/);
  assert.match(res.text, /हमारा काम/);
  assert.match(res.text, /हरित धरा के लिए दान करें/, "pattern-based sentence");
  assert.match(res.text, /href="\/\?lang=en"/, "switch back to English");

  // The cookie keeps Hindi on the next page; option values stay English
  const temple = await fetch(`${base}/donate/temple`, {
    headers: { cookie: "lang=hi" },
  }).then((r) => r.text());
  assert.match(temple, /दैनिक आरती और भोग/);
  assert.match(temple, /value="Daily aarti and bhog"/);
  assert.match(temple, /name="cause" value="Community Temple"/);

  // A donation submitted from the Hindi page still works
  const pay = await fetch(`${base}/donate`, {
    method: "POST",
    headers: { cookie: "lang=hi", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...donation,
      cause: "Community Temple",
      purpose: "Daily aarti and bhog",
    }).toString(),
  });
  assert.equal(pay.status, 200);

  // Errors are shown in Hindi
  const bad = await fetch(`${base}/donate`, {
    method: "POST",
    headers: { cookie: "lang=hi", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...donation, pan: "BAD" }).toString(),
  }).then((r) => r.text());
  assert.match(bad, /कृपया सही 10 अक्षरों का पैन लिखें/);

  const adminLogin = await fetch(`${base}/admin/login`, {
    headers: { cookie: "lang=hi" },
  }).then((r) => r.text());
  assert.match(adminLogin, /Admin Login/, "admin pages are not translated");

  res = await req("/?lang=en");
  assert.match(res.text, /What we do/);
});

test("payment failure and unknown thank-you pages", async () => {
  const req = client();

  const callback = await startDonation(req, {
    ...donation,
    cause: "Kanyadaan",
    purpose: "Household starter kit",
  });
  let res = await req("/donate/failure", {
    method: "POST",
    form: { ...callback, status: "failure" },
  });
  assert.equal(res.status, 303);
  assert.match(res.location, /^\/donate\/payment-failed\?txn=TXN_[^&]+&cause=kanyadaan$/);

  res = await req(res.location);
  assert.match(res.text, /Payment not completed/);
  assert.match(
    res.text,
    /href="\/donate\/kanyadaan"/,
    "try again goes back to the same cause",
  );

  assert.equal((await req("/donate/thank-you/TXN_unknown_123")).status, 404);
  assert.equal((await req("/donation/thank-you/TXN_unknown_123")).status, 404);
  assert.equal((await req("/donate/thank-you/<script>")).status, 404);
});

test("membership: errors keep typed values, success redirects to thank-you", async () => {
  const req = client();
  const member = {
    memberName: "Kamla Devi",
    phoneNumber: "9876501234",
    email: "kamla@example.com",
    amount: "50",
    paymentMode: "UPI",
    consent: "on",
  };

  let res = await req("/donation", { method: "POST", form: member });
  assert.equal(res.status, 400);
  assert.match(res.text, /Minimum membership amount/);
  assert.match(res.text, /value="Kamla Devi"/);

  const page = await req("/donation", {
    method: "POST",
    form: { ...member, amount: "11000" },
  });
  assert.equal(page.status, 200);
  const field = (name) =>
    page.text.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`))?.[1] ?? "";
  const cb = { key: "testkey", status: "success", mihpayid: "PAYUM1" };
  for (const name of [
    "txnid",
    "amount",
    "productinfo",
    "firstname",
    "email",
    "udf1",
    "udf2",
    "udf3",
    "udf4",
    "udf5",
  ])
    cb[name] = field(name);
  cb.hash = crypto
    .createHash("sha512")
    .update(
      `testsalt|success||||||${cb.udf5}|${cb.udf4}|${cb.udf3}|${cb.udf2}|${cb.udf1}|${cb.email}|${cb.firstname}|${cb.productinfo}|${cb.amount}|${cb.txnid}|testkey`,
    )
    .digest("hex");

  res = await req("/donation/success", { method: "POST", form: cb });
  assert.equal(res.status, 303, res.text.slice(0, 200));
  res = await req(res.location);
  assert.match(res.text, /Your membership is confirmed/);
  assert.match(res.text, /Lifetime Member/);

  const pdf = await req(`/donation/receipt/${cb.txnid}`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("content-type"), /pdf/);
});

test("only genuine data is saved: bot trap, spam names, duplicates", async () => {
  const req = client();

  // Bot fills the hidden field
  let res = await req("/contact", {
    method: "POST",
    form: { ...message, website: "http://spam.example" },
  });
  assert.equal(res.status, 400);
  res = await req("/volunteer", {
    method: "POST",
    form: { ...volunteer, email: "bot@example.com", website: "x" },
  });
  assert.equal(res.status, 400);

  // Links in names are refused
  res = await req("/volunteer", {
    method: "POST",
    form: { ...volunteer, name: "Buy now www.cheap.ru" },
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /valid name/);
  res = await req("/donate", {
    method: "POST",
    form: { ...donation, donorName: "http://spam.example" },
  });
  assert.equal(res.status, 400);

  // The same volunteer, message and event registration are stored once
  const enquiryModel = require("../models/enquiryModel");
  const contentModel = require("../models/contentModel");
  const volunteersBefore = (await enquiryModel.listVolunteers()).length;
  await req("/volunteer", { method: "POST", form: volunteer });
  assert.equal(
    (await enquiryModel.listVolunteers()).length,
    volunteersBefore,
    "repeat volunteer not stored again",
  );

  const messagesBefore = (await enquiryModel.listMessages()).length;
  await req("/contact", { method: "POST", form: message });
  assert.equal(
    (await enquiryModel.listMessages()).length,
    messagesBefore,
    "same message not stored again",
  );

  const [event] = await contentModel.listEvents();
  if (event) {
    res = await req(`/events/${event.id}/register`, {
      method: "POST",
      form: {
        name: "Sunita Devi",
        phone: "9012345678",
        email: "sunita@example.com",
        people: "1",
        consent: "on",
      },
    });
    assert.equal(res.status, 400);
    assert.match(res.text, /already registered/);
  }

  // The same patient at the same hospital within a week
  res = await req("/medical", { method: "POST", form: medical });
  assert.equal(res.status, 400);
  assert.match(res.text, /already received in the last 7 days/);
});

// ------------------------------------------------------------
// Rate limiting (last: it blocks this IP for the rest of the run)
// ------------------------------------------------------------

// Only the file store can have a half-written line
test(
  "a damaged line (cut-off write) is skipped, other records still read",
  { skip: process.env.MONGODB_URI ? "file storage only" : false },
  async () => {
    const store = require("../models/fileStore");

    await store.appendRecord("torn-test.txt", { n: 1 });
    fs.appendFileSync(path.join(dataDir, "torn-test.txt"), '{"iv":"abc","auth');
    await store.appendRecord("torn-test.txt", { n: 2 });

    const records = await store.readRecords("torn-test.txt");
    assert.deepEqual(
      records.map((r) => r.n),
      [1, 2],
    );
  },
);

test("forms posted from another website are refused, PayU callbacks are not", async () => {
  const req = client();
  const evil = { origin: "https://evil.example" };

  let res = await req("/login", {
    method: "POST",
    form: { email: "a@example.com", password: "whatever1" },
    headers: evil,
  });
  assert.equal(res.status, 403);

  res = await req("/login", {
    method: "POST",
    form: { email: "a@example.com", password: "whatever1" },
    headers: { referer: "https://evil.example/page" },
  });
  assert.equal(res.status, 403, "Referer used when Origin is missing");

  res = await req("/donate/failure", { method: "POST", form: {}, headers: evil });
  assert.equal(res.status, 303, "PayU posts from its own site");

  res = await req("/donate/failure/", { method: "POST", form: {}, headers: evil });
  assert.equal(res.status, 303, "callback URL with a trailing slash too");

  // Visitor on www.<site>, Host without www (an IP cannot carry "www.", so use localhost)
  const local = base.replace("127.0.0.1", "localhost");
  const www = await fetch(local + "/login", {
    method: "POST",
    headers: {
      origin: local.replace("//", "//www."),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "email=a%40example.com&password=whatever1",
    redirect: "manual",
  });
  assert.notEqual(www.status, 403, "www and bare domain are the same site");
});

test("PDFs print Hindi names that used to crash the font engine", async () => {
  const {
    generateDonationCertificate,
  } = require("../services/donationCertificateService");
  const { generateMedicalReceipt } = require("../services/medicalReceiptService");
  const name = "रामकांत चौधरी, हर्रैया";

  const cert = await generateDonationCertificate({
    donorName: name,
    cause: "Community Temple",
    dedicationType: "In memory of",
    dedicatedTo: "स्वर्गीय श्री राम प्रसाद",
    amount: 501,
    txnid: "TXN_hindi_test",
    paymentDate: new Date(),
  });
  assert.ok(cert.buffer.length > 1000);

  const receipt = await generateMedicalReceipt({
    patientName: name,
    aadharNumber: "234123412346",
    nameDiseases: "मोतियाबिंद",
    hospitalName: "जिला अस्पताल बस्ती",
    referenceRegistrationNumber: "MED-1-TEST",
    submissionDate: new Date(),
  });
  assert.ok(receipt.length > 1000);
});

test("guest donor gets an account with a temporary password to replace", async () => {
  const userAuthService = require("../services/userAuthService");
  const userModel = require("../models/userModel");
  const req = client();

  // A guest donation (no account) makes one for that email afterwards
  const callback = await startDonation(req, {
    ...donation,
    email: "guest.donor@example.com",
  });
  assert.equal(
    (await req("/donate/success", { method: "POST", form: callback })).status,
    303,
  );
  // Made in the background after the redirect; wait for it (bcrypt is slow)
  let made = null;
  for (let i = 0; i < 50 && !made?.mustChangePassword; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    made = await userModel.findByEmail("guest.donor@example.com");
  }
  assert.ok(made, "account created after the verified payment");
  assert.equal(made.mustChangePassword, true);

  // Same for an existing account: nothing is changed
  assert.equal(
    await userAuthService.ensureAccountForPayment({ email: "guest.donor@example.com" }),
    null,
  );

  // New temporary password (the email itself cannot be read in tests)
  const { password } = await userAuthService.sendLoginDetails(made);
  let res = await req("/login", {
    method: "POST",
    form: { email: "guest.donor@example.com", password },
  });
  assert.equal(res.location, "/account/set-password", "must choose a password first");
  assert.equal((await req("/account")).location, "/account/set-password");

  res = await req("/account/set-password", {
    method: "POST",
    form: { password: "mypass2026", confirmPassword: "mypass2026" },
  });
  assert.equal(res.location, "/account?password=changed#security");

  // Without a temporary password, this page cannot change the password
  res = await req("/account/set-password", {
    method: "POST",
    form: { password: "other2026x", confirmPassword: "other2026x" },
  });
  assert.equal(res.status, 400);
  res = await req("/account");
  assert.equal(res.status, 200);
  assert.match(
    res.text,
    new RegExp(callback.txnid),
    "logging in with the emailed password verified the email",
  );

  // An expired temporary password is refused
  const again = await userAuthService.sendLoginDetails(
    await userModel.findByEmail("guest.donor@example.com"),
  );
  await userModel.updateUser(await userModel.findByEmail("guest.donor@example.com"), {
    tempPasswordExpires: Date.now() - 1000,
  });
  res = await client()("/login", {
    method: "POST",
    form: { email: "guest.donor@example.com", password: again.password },
  });
  assert.equal(res.status, 401);
  assert.match(res.text, /temporary password has expired/);
});

test("admin users page: search, reset link, new login details", async () => {
  const admin = client();
  await admin("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });

  let res = await admin("/admin/users?q=guest.donor");
  assert.equal(res.status, 200);
  assert.match(res.text, /guest\.donor@example\.com/);
  assert.doesNotMatch(res.text, /asha@example\.com/, "search filters the list");

  res = await admin("/admin/users/reset", {
    method: "POST",
    form: { email: "guest.donor@example.com" },
  });
  assert.match(res.location, /done=reset/);
  const userModel = require("../models/userModel");
  assert.ok((await userModel.findByEmail("guest.donor@example.com")).resetTokenHash);

  res = await admin("/admin/users/login-details", {
    method: "POST",
    form: { email: "guest.donor@example.com" },
  });
  assert.match(res.location, /done=login/);
  assert.equal(
    (await userModel.findByEmail("guest.donor@example.com")).mustChangePassword,
    true,
  );

  assert.equal((await client()("/admin/users")).status, 302, "admin only");
});

test("admin corrects a mistyped donor email; history kept, receipt follows", async () => {
  const req = client();
  const callback = await startDonation(req, {
    ...donation,
    email: "typo@exmaple.com",
    donorName: "Kamla Devi",
  });
  await req("/donate/success", { method: "POST", form: callback });
  const txn = callback.txnid;

  const admin = client();
  await admin("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });

  let res = await admin("/admin/dashboard?view=donations");
  assert.match(res.text, new RegExp(`/admin/records/donation/${txn}/edit`));

  res = await admin(`/admin/records/donation/${txn}/edit`);
  assert.equal(res.status, 200);
  assert.match(res.text, /typo@exmaple\.com/);

  res = await admin(`/admin/records/donation/${txn}/edit`, {
    method: "POST",
    form: { donorName: "Kamla Devi", email: "not-an-email", phoneNumber: "9876543210" },
  });
  assert.equal(res.status, 400, "bad email refused");

  res = await admin(`/admin/records/donation/${txn}/edit`, {
    method: "POST",
    form: {
      donorName: "Kamla Devi Gupta",
      email: "kamla@example.com",
      phoneNumber: "9876543210",
      reason: "Donor called",
    },
  });
  assert.match(res.location, /saved=1/);

  res = await admin(res.location);
  assert.match(res.text, /typo@exmaple\.com<\/s>/, "old value shown in history");
  assert.match(res.text, /Donor called/);

  // Everywhere reads the corrected record
  const donationService = require("../services/donationService");
  const fixed = await donationService.findDonation(txn);
  assert.equal(fixed.email, "kamla@example.com");
  assert.equal(fixed.donorName, "Kamla Devi Gupta");
  res = await admin("/admin/dashboard?view=donations&q=kamla@example.com");
  assert.match(res.text, /Kamla Devi Gupta/);

  // Same email in other case and a +91 phone are not changes
  res = await admin(`/admin/records/donation/${txn}/edit`, {
    method: "POST",
    form: {
      donorName: "Kamla Devi Gupta",
      email: "KAMLA@Example.com",
      phoneNumber: "+91 98765 43210",
    },
  });
  assert.match(res.location, /saved=none/);

  // Amount cannot be changed through the form
  await admin(`/admin/records/donation/${txn}/edit`, {
    method: "POST",
    form: {
      donorName: "Kamla Devi Gupta",
      email: "kamla@example.com",
      phoneNumber: "9876543210",
      amount: "1",
    },
  });
  assert.equal(Number((await donationService.findDonation(txn)).amount), 1100);

  assert.equal((await client()(`/admin/records/donation/${txn}/edit`)).status, 302);
});

test("admin corrects a medical request; receipt is printed again at the same link", async () => {
  const req = client();
  let res = await req("/medical", {
    method: "POST",
    form: { ...medical, aadharNumber: "999988887779", hospitalName: "PHC Harraiya" },
  });
  const params = new URL(res.location, base).searchParams;
  const ref = params.get("reference");
  const file = params.get("file");

  const admin = client();
  await admin("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });
  res = await admin(`/admin/records/medical/${ref}/edit`, {
    method: "POST",
    form: {
      patientName: "Ram Prasad Verma",
      patientEmail: medical.patientEmail,
      patientPhoneNumber: medical.patientPhoneNumber,
      hospitalName: "PHC Harraiya",
      nameDiseases: medical.nameDiseases,
    },
  });
  assert.match(res.location, /saved=1/);
  assert.equal((await req(`/medical/receipt/${file}`)).status, 200);
  res = await admin("/admin/dashboard?view=medical&q=Verma");
  assert.match(res.text, /Ram Prasad Verma/);
});

test("Google login: set up in admin settings, verified email logs in", async () => {
  const admin = client();
  await admin("/admin/login", { method: "POST", form: { password: ADMIN_PASSWORD } });

  let res = await admin("/admin/settings", {
    method: "POST",
    form: { googleClientId: "wrong", googleClientSecret: "s", googleEnabled: "on" },
  });
  assert.equal(res.status, 400);

  res = await admin("/admin/settings", {
    method: "POST",
    form: {
      googleClientId: "123-abc.apps.googleusercontent.com",
      googleClientSecret: "secret-1",
      googleEnabled: "on",
    },
  });
  assert.equal(res.location, "/admin/settings?saved=1");
  res = await admin("/admin/settings");
  assert.doesNotMatch(res.text, /secret-1/, "the secret is never shown again");
  assert.match(res.text, /\/auth\/google\/callback/);

  // Someone registers the Googler's address first (never confirmed)
  const attacker = client();
  await attacker("/register", {
    method: "POST",
    form: {
      ...user,
      email: "googler@example.com",
      password: "taken2026",
      confirmPassword: "taken2026",
    },
  });
  assert.equal((await attacker("/account")).status, 200);

  const req = client();
  assert.match((await req("/login")).text, /Continue with Google/);

  res = await req("/auth/google");
  const google = new URL(res.location);
  assert.equal(google.host, "accounts.google.com");
  assert.equal(
    google.searchParams.get("client_id"),
    "123-abc.apps.googleusercontent.com",
  );
  const state = google.searchParams.get("state");

  // Google's servers, faked
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
      assert.equal(new URLSearchParams(options.body).get("client_secret"), "secret-1");
      return new Response(JSON.stringify({ access_token: "token-1" }), { status: 200 });
    }
    if (String(url).startsWith("https://openidconnect.googleapis.com/")) {
      return new Response(
        JSON.stringify({
          sub: "g-1",
          email: "Googler@Example.com",
          email_verified: true,
          name: "Google User",
        }),
        { status: 200 },
      );
    }
    return realFetch(url, options);
  };

  try {
    res = await req(`/auth/google/callback?state=bad&code=abc`);
    assert.equal(res.status, 400, "wrong state refused");

    res = await req("/auth/google");
    const state2 = new URL(res.location).searchParams.get("state");
    assert.notEqual(state2, state);
    res = await req(`/auth/google/callback?state=${state2}&code=abc`);
    assert.equal(res.location, "/account");
    res = await req("/account");
    assert.equal(res.status, 200);
    assert.match(res.text, /googler@example\.com/);
    const userModel = require("../models/userModel");
    const user = await userModel.findByEmail("googler@example.com");
    assert.equal(user.emailVerified, true);
    assert.equal(user.googleId, "g-1");

    // The unconfirmed password and its session stop working
    assert.equal((await attacker("/account")).status, 302, "squatter logged out");
    res = await client()("/login", {
      method: "POST",
      form: { email: "googler@example.com", password: "taken2026" },
    });
    assert.equal(res.status, 401, "squatter's password no longer works");
  } finally {
    globalThis.fetch = realFetch;
    await admin("/admin/settings", {
      method: "POST",
      form: { googleClientId: "123-abc.apps.googleusercontent.com" },
    });
  }
  assert.doesNotMatch(
    (await client()("/login")).text,
    /Continue with Google/,
    "switched off",
  );
});

test(
  "MongoDB: sessions are stored encrypted; an unreadable old session just logs out",
  { skip: process.env.MONGODB_URI ? false : "MongoDB only" },
  async () => {
    const { getClient, DB_NAME } = require("../models/mongoStore");
    const sessions = (await getClient()).db(DB_NAME).collection("sessions");

    const req = client();
    await req("/login", {
      method: "POST",
      form: { email: user.email, password: "newpass123" },
    });
    const stored = await sessions.find({}).sort({ expires: -1 }).limit(1).next();
    assert.match(String(stored.session), /"authTag"/, "encrypted");
    assert.doesNotMatch(String(stored.session), /asha@example/i);

    // A session saved in plain JSON (older format) is not readable
    await sessions.insertOne({
      _id: "old-session",
      expires: new Date(Date.now() + 3600e3),
      session: JSON.stringify({ cookie: {}, user: { email: "x@example.com" } }),
    });
    const sid = require("cookie-signature").sign("old-session", "test-secret");
    const res = await fetch(base + "/account", {
      headers: { cookie: `connect.sid=s%3A${encodeURIComponent(sid)}` },
      redirect: "manual",
    });
    assert.equal(res.status, 302, "treated as logged out, not an error");
  },
);

test("guesses on one account are not reset by logging in to another", async () => {
  const req = client();
  for (let i = 0; i < 5; i += 1) {
    await req("/login", {
      method: "POST",
      form: { email: "target@example.com", password: "wrong-pass1" },
    });
  }
  // Logging in to one's own account in between
  await client()("/login", {
    method: "POST",
    form: { email: "guest.donor@example.com", password: "mypass2026" },
  });
  const res = await req("/login", {
    method: "POST",
    form: { email: "target@example.com", password: "wrong-pass1" },
  });
  assert.equal(res.status, 429);
});

// Last: it leaves this IP blocked from logging in for 15 minutes
test("too many failed logins are blocked with 429", async () => {
  const req = client();
  let res;

  for (let i = 0; i < 6; i += 1) {
    res = await req("/login", {
      method: "POST",
      form: { email: "nobody@example.com", password: "wrong-pass1" },
    });
  }

  assert.equal(res.status, 429);
  assert.match(res.text, /Too many attempts/);
});
