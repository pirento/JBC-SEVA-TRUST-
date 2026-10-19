// columns: [[header, row => value], ...]
function toCsv(rows, columns) {
  const cell = (value) => {
    let text = value === undefined || value === null ? "" : String(value);

    // Stop spreadsheet apps from running cell text as a formula
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [
    columns.map(([header]) => cell(header)).join(","),
    ...rows.map((row) => columns.map(([, get]) => cell(get(row))).join(",")),
  ];

  // BOM so Excel opens Hindi names and ₹ correctly
  return "﻿" + lines.join("\r\n") + "\r\n";
}

module.exports = { toCsv };
