// PIPEOX — navigation, search, motion, inquiry + newsletter forms

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const faDigits = (n) => new Intl.NumberFormat("fa-IR").format(n);

// ---- Header: solid once the page scrolls (home header floats over the hero) ----
const header = document.getElementById("siteHeader");
const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 24);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// ---- Mobile menu ----
const menuBtn = document.getElementById("hamb");
const links = document.getElementById("navlinks");
function setMenu(open) {
  links.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  header.classList.toggle("scrolled", open || window.scrollY > 24);
}
menuBtn.addEventListener("click", () => setMenu(!links.classList.contains("open")));
links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

// ---- Scroll reveal + stat counters ----
const counters = document.querySelectorAll(".count[data-to]");
function runCounter(el) {
  const target = Number(el.dataset.to);
  if (reduceMotion || !target) return;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / 1600);
    el.textContent = faDigits(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        entry.target.querySelectorAll(".count[data-to]").forEach(runCounter);
        io.unobserve(entry.target);
      }),
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
} else {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
}
// Counters outside a .reveal block still animate once
counters.forEach((el) => !el.closest(".reveal") && runCounter(el));

// ---- Cursor-following glow on tiles ----
if (!reduceMotion) {
  document.querySelectorAll(".tile, .spot").forEach((el) =>
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }),
  );
}

// ---- Product search ----
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

// ---- Shared: POST a form as multipart and read the JSON reply ----
async function postForm(form, data) {
  const res = await fetch(form.action, { method: "POST", body: data, headers: { Accept: "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    const err = new Error(json.error || "ارسال ناموفق بود.");
    err.field = json.field;
    throw err;
  }
  return json;
}
const networkMessage = (err) => (err instanceof TypeError ? "ارتباط با سرور برقرار نشد." : err.message);

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

  fileInput?.addEventListener("change", () => {
    const f = fileInput.files[0];
    fileLabel.textContent = f ? f.name : fileLabel.dataset.empty;
    fileInput.closest(".file-field").classList.toggle("has-file", !!f);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    // Accept Persian digits — the server normalizes them too
    const phoneDigits = form.elements.phone.value.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\D/g, "");
    const file = fileInput?.files[0];

    if (name.length < 2) {
      showStatus("لطفاً نام خود را وارد کنید.", "error");
      return markInvalid("name");
    }
    if (phoneDigits.length < 8) {
      showStatus("شماره تماس معتبر نیست.", "error");
      return markInvalid("phone");
    }
    if (file && file.size > MAX_MB * 1024 * 1024) {
      showStatus(`حداکثر حجم فایل ${faDigits(MAX_MB)} مگابایت است.`, "error");
      return markInvalid("attachment");
    }

    const data = new FormData(form);
    data.set("page", location.pathname);
    submitBtn.disabled = true;
    showStatus("در حال ارسال...", "ok");
    try {
      await postForm(form, data);
      form.reset();
      fileInput?.dispatchEvent(new Event("change"));
      showStatus("درخواست شما ثبت شد. کارشناسان ما به‌زودی با شما تماس می‌گیرند.", "ok");
    } catch (err) {
      if (err.field) markInvalid(err.field);
      const tel = form.dataset.phone;
      showStatus(networkMessage(err) + (tel ? ` در صورت فوریت با ${tel} تماس بگیرید.` : ""), "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ---- Newsletter ----
const news = document.getElementById("newsletterForm");
if (news) {
  const out = news.querySelector(".newsletter-status");
  const say = (msg, type) => {
    out.textContent = msg;
    out.dataset.type = type;
    out.hidden = false;
  };
  news.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = news.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return say("لطفاً یک ایمیل معتبر وارد کنید.", "error");
    const btn = news.querySelector("button");
    btn.disabled = true;
    try {
      await postForm(news, new FormData(news));
      news.reset();
      say("عضویت شما ثبت شد. ممنون!", "ok");
    } catch (err) {
      say(networkMessage(err), "error");
    } finally {
      btn.disabled = false;
    }
  });
}
