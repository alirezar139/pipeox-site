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
// Filters cards in place on pages that have them; elsewhere Enter jumps to the catalogue.
const search = document.getElementById("search");
const cards = [...document.querySelectorAll(".product")];
const noResults = document.getElementById("noResults");

function filterProducts(query) {
  const q = query.trim().toLowerCase();
  let visible = 0;
  cards.forEach((card) => {
    const match = (card.dataset.search + " " + card.textContent).toLowerCase().includes(q);
    card.hidden = !match;
    if (match) visible++;
  });
  if (noResults) noResults.hidden = visible > 0;
}

if (search) {
  search.addEventListener("input", () => cards.length && filterProducts(search.value));
  search.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const grid = document.getElementById("productGrid");
    if (grid) grid.scrollIntoView({ block: "start" });
    else location.href = "/products/?q=" + encodeURIComponent(search.value.trim());
  });
  const initial = new URLSearchParams(location.search).get("q");
  if (initial && cards.length) {
    search.value = initial;
    filterProducts(initial);
  }
}

// ---- Inquiry form ----
const form = document.getElementById("quoteForm");

if (form) {
  const status = document.getElementById("formStatus");
  const submitBtn = form.querySelector('button[type="submit"]');
  const fileInput = form.elements.attachment;
  const fileLabel = form.querySelector(".file-label");
  const MAX_MB = 8;

  const showStatus = (message, type) => {
    status.textContent = message;
    status.dataset.type = type;
    status.hidden = false;
  };
  const markInvalid = (field) => {
    const el = form.elements[field];
    if (!el) return;
    el.setAttribute("aria-invalid", "true");
    el.focus();
  };
  form.addEventListener("input", (e) => e.target.removeAttribute?.("aria-invalid"));

  // Links carrying data-category pre-select that product group
  document.querySelectorAll("[data-category]").forEach((el) =>
    el.addEventListener("click", () => {
      const option = [...form.elements.category.options].find((o) => o.text === el.dataset.category);
      if (option) form.elements.category.value = option.value || option.text;
    }),
  );

  fileInput?.addEventListener("change", () => {
    const f = fileInput.files[0];
    fileLabel.textContent = f ? "📎 " + f.name : fileLabel.dataset.empty;
    fileInput.closest(".file-field").classList.toggle("has-file", !!f);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    // Accept Persian digits — the server normalizes them too
    const phoneDigits = form.elements.phone.value.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\D/g, "");
    const file = fileInput?.files[0];

    if (name.length < 2) return showStatus("لطفاً نام خود را وارد کنید.", "error"), markInvalid("name");
    if (phoneDigits.length < 8) return showStatus("شماره تماس معتبر نیست.", "error"), markInvalid("phone");
    if (file && file.size > MAX_MB * 1024 * 1024)
      return showStatus(`حداکثر حجم فایل ${MAX_MB} مگابایت است.`, "error"), markInvalid("attachment");

    const data = new FormData(form);
    data.set("page", location.pathname);
    submitBtn.disabled = true;
    showStatus("در حال ارسال...", "ok");

    try {
      const res = await fetch(form.action, { method: "POST", body: data, headers: { Accept: "application/json" } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        if (json.field) markInvalid(json.field);
        throw new Error(json.error || "ارسال ناموفق بود.");
      }
      form.reset();
      fileInput?.dispatchEvent(new Event("change"));
      showStatus("درخواست شما ثبت شد. کارشناسان ما به‌زودی با شما تماس می‌گیرند.", "ok");
    } catch (err) {
      const tel = form.dataset.phone;
      const fallback = tel ? ` در صورت فوریت با ${tel} تماس بگیرید.` : "";
      showStatus((err instanceof TypeError ? "ارتباط با سرور برقرار نشد." : err.message) + fallback, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
}
