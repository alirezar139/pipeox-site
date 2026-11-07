# وب‌سایت PIPEOX

سایت چندصفحه‌ای فارسی (راست‌چین) برای تأمین لوله، اتصالات، فلنج و شیرآلات صنعتی.
- **فرانت‌اند:** Eleventy (سایت استاتیک) + CSS و JS خالص
- **بک‌اند:** PHP + SQLite برای فرم استعلام و پنل مدیریت

## اجرا

```bash
npm install      # فقط بار اول
npm start        # سرور توسعه: http://localhost:8080 (بدون PHP؛ فرم ارسال نمی‌شود)
npm run build    # ساخت نسخه نهایی در dist/
```

برای تست کامل همراه با فرم و پنل مدیریت، بعد از build این دستور را اجرا کنید:
```bash
cd dist && php -S localhost:8090
```

## انتشار روی هاست (cPanel / DirectAdmin)

1. فایل `src/api/config.sample.php` را به `src/api/config.php` کپی و مقادیرش را پر کنید:
   رمز پنل مدیریت، ایمیل یا ربات بله. برای ساخت هش رمز:
   `php -r "echo password_hash('رمز-شما', PASSWORD_DEFAULT);"`
2. در `src/_data/site.json` مقدار `url` را دامنه سایت بگذارید (مثلاً `https://pipeox.ir`)
   و اطلاعات تماس را وارد کنید.
3. `npm run build` را اجرا کنید و **محتوای `dist/`** را در `public_html` آپلود کنید.
4. پوشه داده (`data_dir` در config) خودکار ساخته می‌شود و پیش‌فرض آن **بیرون از public_html** است.
5. پنل استعلام‌ها: `https://دامنه/api/admin.php`

## ساختار

```
src/
├─ _data/
│  ├─ site.json          ← نام، دامنه، اطلاعات تماس، منو
│  └─ products.json      ← محصولات: کارت‌ها، صفحه هر محصول، فرم و فوتر از این فایل ساخته می‌شوند
├─ _includes/
│  ├─ layouts/           ← base (head و سئو) · page (صفحات داخلی) · article (مقالات)
│  ├─ partials/          ← header · footer · quote-form · product-card · story-card · cta
│  └─ styles/            ← CSS به تفکیک بخش (در build یک فایل می‌شود)
├─ index.njk             ← صفحه اصلی
├─ products/             ← لیست محصولات + صفحه هر محصول (خودکار از products.json)
├─ insights/*.md         ← مقالات دانش فنی (Markdown)
├─ contact.njk · 404.njk · sitemap.njk · robots.njk
├─ api/                  ← بک‌اند PHP
│  ├─ inquiry.php        ← دریافت فرم
│  ├─ admin.php          ← پنل مدیریت استعلام‌ها
│  ├─ lib/               ← bootstrap (DB) · notify (ایمیل/بله/تلگرام) · smtp
│  └─ config.sample.php  ← نمونه تنظیمات (config.php در git نیست)
└─ assets/  img/ · fonts/ · js/main.js
```

## کارهای رایج

| کار | کجا |
|---|---|
| تغییر اطلاعات تماس | `src/_data/site.json` |
| افزودن یا ویرایش محصول | یک ورودی در `src/_data/products.json`؛ صفحه‌اش خودکار ساخته می‌شود |
| نوشتن مقاله | یک فایل `.md` جدید در `src/insights/` (از روی مقالات موجود الگو بگیرید) |
| فعال‌کردن اعلان بله یا ایمیل | `src/api/config.php` |
| تغییر رنگ‌ها | متغیرهای `:root` در `src/_includes/styles/01-base.css` |

## نکات
- تصاویر خودکار به WebP تبدیل و در چند اندازه ساخته می‌شوند (`dist/assets/img/opt/`).
- تلگرام از اغلب سرورهای داخل ایران در دسترس نیست؛ برای هاست ایرانی از **بله** استفاده کنید.
- `sitemap.xml`، تگ canonical و تصویر اشتراک‌گذاری فقط وقتی `site.url` تنظیم شده باشد کامل می‌شوند.
