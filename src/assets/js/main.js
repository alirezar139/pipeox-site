// PIPEOX — mobile menu, product search, inquiry form

// ---- Mobile menu ----
const menuBtn = document.getElementById("hamb");
const links = document.getElementById("navlinks");

function setMenu(open) {
  links.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
}
menuBtn.addEventListener("click", () => setMenu(!links.classList.contains("open")));
links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

// ---- Product search ----
const search = document.getElementById("search");
const cards = [...document.querySelectorAll(".product")];
const noResults = document.getElementById("noResults");

search?.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach((card) => {
    const match = (card.dataset.search + " " + card.textContent).toLowerCase().includes(q);
    card.hidden = !match;
    if (match) visible++;
  });
  noResults.hidden = visible > 0;
});
search?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("products").scrollIntoView();
});

// ---- Inquiry form ----
const form = document.getElementById("quoteForm");
const status = document.getElementById("formStatus");
const category = form.elements.category;

function showStatus(message, type) {
  status.textContent = message;
  status.dataset.type = type;
  status.hidden = false;
}

// Any link carrying data-category pre-selects that product group in the form
document.querySelectorAll("[data-category]").forEach((el) =>
  el.addEventListener("click", () => {
    const wanted = el.dataset.category;
    const option = [...category.options].find((o) => o.text === wanted);
    if (option) category.value = option.value || option.text;
  }),
);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const phone = String(data.get("phone") || "").trim();

  if (!name || !phone) {
    showStatus("لطفاً نام و شماره تماس را وارد کنید.", "error");
    (name ? form.elements.phone : form.elements.name).focus();
    return;
  }
  if (phone.replace(/\D/g, "").length < 8) {
    showStatus("شماره تماس معتبر به نظر نمی‌رسد.", "error");
    form.elements.phone.focus();
    return;
  }

  const to = form.dataset.email;
  if (!to) {
    // No recipient configured in src/_data/site.json → don't open an empty email draft
    const tel = form.dataset.phone;
    showStatus(
      tel
        ? `ارسال آنلاین فعلاً در دسترس نیست. لطفاً با شماره ${tel} تماس بگیرید.`
        : "ارسال آنلاین فعلاً در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.",
      "error",
    );
    return;
  }

  // Temporary transport until the server endpoint (phase 2) is in place
  const subject = encodeURIComponent("درخواست استعلام از وب‌سایت PIPEOX");
  const body = encodeURIComponent(
    `نام: ${name}\nتلفن: ${phone}\nگروه محصول: ${data.get("category") || "ذکر نشده"}\nتوضیحات: ${data.get("details") || "—"}`,
  );
  showStatus("در حال باز کردن برنامه ایمیل شما...", "ok");
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
});
