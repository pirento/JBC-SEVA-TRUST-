const fs = require("fs");
const path = require("path");

const trust = require("../config/trustConfig");
const { appUrl } = require("../config/appConfig");
const hi = require("../locales/hi");

// ============================================================
// BRANDED EMAIL TEMPLATE
// ============================================================
//
// One layout for every email: logo header in the trust's navy and
// saffron, a details table, an optional button and a footer. Built
// with tables and inline styles because email apps ignore most CSS.
// Pass English text; with lang "hi" fixed text is shown in Hindi.
// ============================================================

const COLORS = {
  navy: "#15375c",
  saffron: "#dd870d",
  saffronText: "#b86304",
  cream: "#faf6ee",
  page: "#f2efe8",
  text: "#1d2733",
  muted: "#5b6676",
  line: "#e6e1d6",
};

// Attached to the email and shown with cid:jbc-logo (works offline and
// in clients that block remote images)
const LOGO_CID = "jbc-logo";
const logoPath = path.join(__dirname, "..", "public", "images", "email-logo.png");

function logoAttachment() {
  return fs.existsSync(logoPath)
    ? [{ filename: "jbc-seva-trust.png", path: logoPath, cid: LOGO_CID }]
    : [];
}

// Hindi for fixed text; anything not in locales/hi.js stays as it is
function t(text, lang) {
  if (lang !== "hi" || !text) return text;
  return hi[text] || text;
}

const escape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Builds { html, text } for an email.
 * opts: {
 *   lang, preheader, heading, greeting, paragraphs: [],
 *   rows: [[label, value]], button: { label, url }, note,
 *   closing (default "With gratitude,"), footerNote
 * }
 * Labels, heading, paragraphs, note and button label are translated;
 * row values are shown as given (translate them before if needed).
 */
function renderEmail(opts) {
  const lang = opts.lang === "hi" ? "hi" : "en";
  const tr = (s) => t(s, lang);

  const rows = (opts.rows || []).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  const paragraphs = (opts.paragraphs || []).filter(Boolean);
  const closing = tr(opts.closing || "With gratitude,");
  const tagline = lang === "hi" ? trust.taglineHindi : trust.tagline;

  const rowsHtml = rows.length
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0 6px;">
        ${rows
          .map(
            ([label, value]) => `
        <tr>
          <td style="padding:10px 12px 10px 0;border-bottom:1px solid ${COLORS.line};color:${COLORS.muted};font-size:14px;width:42%;vertical-align:top;">${escape(tr(label))}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${COLORS.line};color:${COLORS.text};font-size:15px;font-weight:bold;vertical-align:top;word-break:break-word;">${escape(value)}</td>
        </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const buttonHtml = opts.button
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
        <tr>
          <td style="background:${COLORS.saffron};border-radius:6px;">
            <a href="${escape(opts.button.url)}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${escape(tr(opts.button.label))}</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 6px;font-size:12px;color:${COLORS.muted};word-break:break-all;">${escape(opts.button.url)}</p>`
    : "";

  const noteHtml = opts.note
    ? `
      <div style="margin:20px 0 4px;padding:12px 14px;background:${COLORS.cream};border-left:4px solid ${COLORS.saffron};font-size:13px;color:${COLORS.muted};line-height:1.5;">${escape(tr(opts.note))}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(tr(opts.heading))}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(tr(opts.preheader || opts.heading))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

          <tr>
            <td style="background:${COLORS.navy};padding:18px 28px;border-bottom:4px solid ${COLORS.saffron};">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;"><img src="cid:${LOGO_CID}" width="52" height="52" alt="JBC Seva Trust" style="display:block;border:0;"></td>
                  <td>
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#ffffff;line-height:1;">JBC</div>
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:${COLORS.saffron};margin-top:4px;">SEVA TRUST</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 24px;color:${COLORS.text};font-size:15px;line-height:1.6;">
              <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:23px;color:${COLORS.navy};">${escape(tr(opts.heading))}</h1>
              ${opts.greeting ? `<p style="margin:0 0 12px;">${escape(opts.greeting)}</p>` : ""}
              ${paragraphs.map((p) => `<p style="margin:0 0 12px;">${escape(tr(p))}</p>`).join("")}
              ${rowsHtml}
              ${buttonHtml}
              ${noteHtml}
              <p style="margin:22px 0 0;">${escape(closing)}<br><strong style="color:${COLORS.navy};">${escape(lang === "hi" ? "जेबीसी सेवा ट्रस्ट" : trust.name)}</strong></p>
            </td>
          </tr>

          <tr>
            <td style="background:${COLORS.cream};padding:16px 28px;font-size:12px;line-height:1.6;color:${COLORS.muted};border-top:1px solid ${COLORS.line};">
              <strong style="color:${COLORS.saffronText};">${escape(tagline)}</strong><br>
              ${escape(tr(trust.legalForm))} · ${escape(tr(trust.location))}<br>
              <a href="mailto:${trust.email}" style="color:${COLORS.navy};">${trust.email}</a> · <a href="tel:+91${trust.phone}" style="color:${COLORS.navy};">${trust.phoneDisplay}</a><br>
              <a href="${escape(appUrl)}" style="color:${COLORS.navy};">${escape(appUrl.replace(/^https?:\/\//, ""))}</a>
              ${opts.footerNote ? `<br>${escape(tr(opts.footerNote))}` : ""}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    tr(opts.heading),
    "",
    opts.greeting,
    ...paragraphs.map(tr),
    "",
    ...rows.map(([label, value]) => `${tr(label)}: ${value}`),
    opts.button ? `\n${tr(opts.button.label)}: ${opts.button.url}` : "",
    opts.note ? `\n${tr(opts.note)}` : "",
    "",
    closing,
    lang === "hi" ? "जेबीसी सेवा ट्रस्ट" : trust.name,
    `${tagline} · ${tr(trust.location)} · ${trust.email} · ${trust.phoneDisplay} · ${appUrl}`,
  ]
    .filter((line) => line !== undefined && line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { html, text };
}

module.exports = { renderEmail, logoAttachment, t, LOGO_CID };
