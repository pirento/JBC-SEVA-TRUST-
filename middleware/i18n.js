const hi = require("../locales/hi");

// ============================================================
// HINDI / ENGLISH
// ============================================================
//
// The site is written in English. With lang=hi, each rendered page is
// translated by looking up whole text nodes and a few attributes
// (placeholder, title, aria-label, alt) in locales/hi.js. Form values
// are never touched, so what the server receives stays in English.
// ============================================================

const escape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "&#39;");

// Quotes may reach the page raw (template text) or escaped (EJS output);
// compare in one form
const squash = (s) =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#34;|&quot;/g, '"');
const keyOf = (en) => squash(escape(en));

const dict = new Map(Object.entries(hi).map(([en, h]) => [keyOf(en), escape(h)]));
const tr = (text) => dict.get(text);

// Sentences built around a programme or person name
const patterns = [
  [/^Donate to (.+)$/, (m) => `${tr(m[1]) || m[1]} के लिए दान करें`],
  [/^Support (.+)$/, (m) => `${tr(m[1]) || m[1]} को सहयोग दें`],
  [/^Wherever (.+) needs it$/, (m) => `जहाँ ${tr(m[1]) || m[1]} को ज़रूरत हो`],
  [
    /^Money given for (.+) is used only for \1\.$/,
    (m) => `${tr(m[1]) || m[1]} के लिए दिया गया धन केवल उसी पर खर्च होता है।`,
  ],
  [
    /^No updates yet for (.+)\. Photos and news will appear here as the work happens\.$/,
    (m) =>
      `${tr(m[1]) || m[1]} के लिए अभी कोई अपडेट नहीं। काम होने पर फ़ोटो और खबरें यहाँ दिखेंगी।`,
  ],
  [/^All (.+) updates →$/, (m) => `${tr(m[1]) || m[1]} के सभी अपडेट →`],
  [/^(.+): updates$/, (m) => `${tr(m[1]) || m[1]}: अपडेट`],
  [/^Part of$/, () => "इसका हिस्सा:"],
  [/^Namaste, (.+)$/, (m) => `नमस्ते, ${m[1]}`],
  [/^Thank you, (.+)!$/, (m) => `धन्यवाद, ${m[1]}!`],
  [
    /^Your donation to (.+) has been received\.$/,
    (m) => `${tr(m[1]) || m[1]} के लिए आपका दान मिल गया है।`,
  ],
  [/^(.+) - JBC Seva Trust$/, (m) => `${translateText(m[1]) || m[1]} - JBC Seva Trust`],
  [/^Call: (.+)$/, (m) => `फ़ोन: ${m[1]}`],
  [/^WhatsApp: (.+)$/, (m) => `व्हाट्सऐप: ${m[1]}`],
  [/^Last updated: (.+)$/, (m) => `अंतिम अपडेट: ${m[1]}`],
];

function translateText(text) {
  const exact = tr(text);
  if (exact) return exact;
  for (const [re, fn] of patterns) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return null;
}

function translateHtml(html) {
  // Leave <script> and <style> bodies alone
  return html
    .split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/)
    .map((part, i) => {
      if (i % 2 === 1) return part;

      return part
        .replace(/>([^<>]+)</g, (whole, text) => {
          const key = squash(text);
          if (!key) return whole;
          const t = translateText(key);
          if (!t) return whole;
          const lead = text.match(/^\s*/)[0];
          const trail = text.match(/\s*$/)[0];
          return `>${lead}${t}${trail}<`;
        })
        .replace(
          /\b(placeholder|title|aria-label|alt|content)="([^"]*)"/g,
          (whole, attr, text) => {
            const t = translateText(squash(text));
            return t ? `${attr}="${t}"` : whole;
          },
        );
    })
    .join("");
}

function readCookie(req, name) {
  const m = String(req.headers.cookie || "").match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`),
  );
  return m ? decodeURIComponent(m[1]) : "";
}

function i18n(req, res, next) {
  let lang = readCookie(req, "lang") === "hi" ? "hi" : "en";

  // ?lang=hi or ?lang=en switches and remembers the choice for a year
  if (req.query.lang === "hi" || req.query.lang === "en") {
    lang = req.query.lang;
    res.cookie("lang", lang, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      httpOnly: true,
    });
  }

  res.locals.lang = lang;

  // Link to the same page in the other language
  const url = new URL(req.originalUrl, "http://x");
  url.searchParams.set("lang", lang === "hi" ? "en" : "hi");
  res.locals.langSwitchUrl = url.pathname + url.search;

  // Admin pages stay in English
  if (lang === "hi" && !req.path.startsWith("/admin")) {
    const render = res.render.bind(res);
    res.render = (view, options, callback) => {
      if (typeof options === "function") [callback, options] = [options, {}];
      if (callback) return render(view, options, callback);

      return render(view, options, (error, html) => {
        if (error) return req.next(error);
        return res.send(translateHtml(html));
      });
    };
  }

  next();
}

module.exports = { i18n, translateHtml };
