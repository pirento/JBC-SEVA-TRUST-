// ========================================
// MEMBERSHIP MODAL
// ========================================

(() => {

  const modal =
    document.getElementById("donationModal");

  const open =
    document.getElementById("donateNowBtn");

  const close =
    document.getElementById("closeDonationModal");

  const cancel =
    document.getElementById("cancelDonation");

  if (!modal || !open) return;


  const show = () => {

    modal.hidden = false;

    document.body.classList.add("modal-open");

  };


  const hide = () => {

    modal.hidden = true;

    document.body.classList.remove("modal-open");

  };


  open.addEventListener("click", show);


  close?.addEventListener(
    "click",
    hide
  );


  cancel?.addEventListener(
    "click",
    hide
  );


  modal.addEventListener(
    "click",
    (e) => {

      if (e.target === modal) {
        hide();
      }

    }
  );


  document.addEventListener(
    "keydown",
    (e) => {

      if (e.key === "Escape") {
        hide();
      }

    }
  );

})();


// ========================================
// DONATION MODAL
// ========================================

(() => {

  const modal =
    document.getElementById(
      "donationPaymentModal"
    );

  const open =
    document.getElementById(
      "donateBtn"
    );

  const close =
    document.getElementById(
      "closeDonationPaymentModal"
    );

  const cancel =
    document.getElementById(
      "cancelDonationPayment"
    );


  if (!modal || !open) return;


  const show = () => {

    modal.hidden = false;

    document.body.classList.add(
      "modal-open"
    );

  };


  const hide = () => {

    modal.hidden = true;

    document.body.classList.remove(
      "modal-open"
    );

  };


  open.addEventListener(
    "click",
    show
  );


  close?.addEventListener(
    "click",
    hide
  );


  cancel?.addEventListener(
    "click",
    hide
  );


  modal.addEventListener(
    "click",
    (e) => {

      if (e.target === modal) {
        hide();
      }

    }
  );


  document.addEventListener(
    "keydown",
    (e) => {

      if (e.key === "Escape") {

        if (!modal.hidden) {
          hide();
        }

      }

    }
  );

})();