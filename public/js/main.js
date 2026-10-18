// ========================================
// MOBILE NAVIGATION
// ========================================

(() => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("siteNav");

  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  toggle.addEventListener("click", () => {
    setOpen(!nav.classList.contains("open"));
  });

  // Close after following an in-page link such as /#work
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
})();


// ========================================
// QUICK AMOUNT BUTTONS
// ========================================

document.querySelectorAll(".amount-chips").forEach((group) => {
  const input = document.getElementById(group.dataset.target);

  if (!input) return;

  const mark = () => {
    group.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("selected", chip.dataset.amount === input.value);
    });
  };

  group.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    input.value = chip.dataset.amount;
    mark();
  });

  input.addEventListener("input", mark);
});


// ========================================
// SHOW / HIDE PASSWORD
// ========================================

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  const input = document.getElementById(button.dataset.togglePassword);

  if (!input) return;

  button.addEventListener("click", () => {
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    button.textContent = hidden ? "Hide" : "Show";
    button.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
  });
});


// ========================================
// DIGITS-ONLY FIELDS (mobile, Aadhaar)
// ========================================

document.querySelectorAll('input[inputmode="numeric"]:not([type="number"])').forEach((input) => {
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "");
    if (digits !== input.value) input.value = digits;
  });
});


// ========================================
// PREVENT DOUBLE SUBMIT
// ========================================

document.querySelectorAll("form.js-once").forEach((form) => {
  form.addEventListener("submit", () => {
    // Runs only after the browser's own validation has passed
    form.querySelectorAll('button[type="submit"]').forEach((button) => {
      button.disabled = true;
      button.dataset.label = button.textContent;
      button.textContent = "Please wait…";
    });
  });
});

// Re-enable buttons when the page is restored from the back/forward cache
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  document.querySelectorAll("form.js-once button[disabled]").forEach((button) => {
    button.disabled = false;
    button.textContent = button.dataset.label || button.textContent;
  });
});
