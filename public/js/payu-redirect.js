// PayU rejects a reused transaction id, so never post this form again
// when the donor comes back with the Back button or from a UPI app.
window.addEventListener("load", () => {
  const form = document.getElementById("payuForm");
  if (!form) return;
  const key = "payu_submitted_" + form.elements.txnid.value;

  try {
    if (sessionStorage.getItem(key)) {
      form.hidden = true;
      document.getElementById("payLoader").hidden = true;
      document.getElementById("payAgainNote").hidden = false;
      return;
    }
  } catch {
    // Storage blocked (private mode): just continue to PayU
  }

  const remember = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked; nothing to remember
    }
  };

  form.addEventListener("submit", remember);

  setTimeout(() => {
    remember();
    form.submit();
  }, 800);
});
