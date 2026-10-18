const medicalService = require("../services/medicalService");

function showMedicalForm(req, res) {
  return res.render("pages/medical");
}

async function submitMedical(req, res) {
  try {
    console.log(
      "\n=================================\n📥 Medical form submitted\n=================================",
    );
    const result = await medicalService.submitMedical(req.body || {});
    console.log("🚀 Redirecting to success page...");
    return res.redirect(
      `/medical/success?reference=${encodeURIComponent(result.reference)}&file=${encodeURIComponent(result.file)}`,
    );
  } catch (error) {
    console.error("❌ Medical request failed:", error.message);
    return res
      .status(500)
      .send(
        `<h1>❌ Something went wrong</h1><p>${error.message}</p><a href="/medical">Go Back</a>`,
      );
  }
}

function showMedicalSuccess(req, res) {
  return res.render("pages/medical-success", {
    reference: req.query.reference || "",
    file: req.query.file || "",
  });
}

async function downloadReceipt(req, res) {
  try {
    const receipt = await medicalService.getMedicalReceipt(
      req.params.fileName || "",
    );
    return res.download(receipt.filePath, receipt.fileName);
  } catch (error) {
    console.error("❌ Receipt download failed:", error.message);
    return res.status(404).send("Receipt not found.");
  }
}

module.exports = {
  showMedicalForm,
  submitMedical,
  showMedicalSuccess,
  downloadReceipt,
};
