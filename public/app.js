document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const field = button.closest(".password-field");
    const input = field ? field.querySelector("input") : null;

    if (!input) {
      return;
    }

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    button.setAttribute("aria-pressed", String(isHidden));
    button.setAttribute("aria-label", isHidden ? "Ocultar senha" : "Mostrar senha");
    button.classList.toggle("is-visible", isHidden);
  });
});

document.querySelectorAll(".debug-dev input[type='checkbox']").forEach((input) => {
  input.addEventListener("change", () => {
    const panel = input.closest(".debug-dev");
    if (panel) {
      panel.classList.toggle("is-open", input.checked);
    }
  });
});
