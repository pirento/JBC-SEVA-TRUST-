const recordEditService = require("../services/recordEditService");

// ========================================
// EDIT A DONATION / MEMBERSHIP / MEDICAL REQUEST
// ========================================

function render(
  res,
  found,
  { kind, id, error = null, notice = "", values, status = 200 },
) {
  return res.status(status).render("admin/record-edit", {
    kind,
    id,
    title: found.spec.title,
    fields: found.spec.fields,
    record: found.record,
    values: values || found.record,
    edits: found.record.edits || [],
    error,
    notice,
  });
}

async function show(req, res, next) {
  try {
    const { kind, id } = req.params;
    const found = await recordEditService.load(kind, id);
    if (!found) return next();

    const notice =
      req.query.saved === "1"
        ? "Changes saved."
        : req.query.saved === "resent"
          ? "Receipt sent again."
          : req.query.saved === "none"
            ? "Nothing was changed."
            : "";
    return render(res, found, { kind, id, notice });
  } catch (error) {
    return next(error);
  }
}

async function save(req, res, next) {
  const { kind, id } = req.params;
  try {
    const result = await recordEditService.save(kind, id, req.body || {});
    if (!result) return next();

    const saved = result.changed ? "1" : result.resend ? "resent" : "none";
    return res.redirect(
      `/admin/records/${kind}/${encodeURIComponent(id)}/edit?saved=${saved}`,
    );
  } catch (error) {
    if (!error.expose) return next(error);
    const found = await recordEditService.load(kind, id);
    if (!found) return next();
    return render(res, found, {
      kind,
      id,
      error: error.message,
      values: { ...found.record, ...req.body },
      status: 400,
    });
  }
}

module.exports = { show, save };
