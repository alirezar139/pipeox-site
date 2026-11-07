<?php
/** Site settings: identity, contact details, and every editable text block on the homepage. */
$pdo = db();
$icons = array_keys(is_file(__DIR__ . '/../icons.php') ? require __DIR__ . '/../icons.php' : []);
$iconLabels = ['trophy' => 'جام', 'check-circle' => 'تیک', 'users-solid' => 'افراد', 'users' => 'افراد (خطی)', 'headset' => 'هدست', 'gear' => 'چرخ‌دنده',
    'shield' => 'سپر', 'doc' => 'سند', 'list' => 'فهرست', 'phone' => 'تلفن', 'mail' => 'ایمیل', 'calendar' => 'تقویم', 'send' => 'ارسال', 'user' => 'کاربر'];
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $p = fn(string $k, int $max = 500) => post_str($k, $max);
    $icon = fn(string $k) => in_array($_POST[$k] ?? '', $icons, true) ? (string)$_POST[$k] : 'check-circle';
    $siteUrl = rtrim($p('site_url', 200), '/');
    $video = $p('projects_video', 500);
    try {
        if ($siteUrl !== '' && !preg_match('#^https?://[^\s/]+$#', $siteUrl)) {
            throw new RuntimeException('آدرس سایت باید فقط دامنه باشد؛ مثلاً https://pipeox.ir');
        }
        if ($video !== '' && !preg_match('#^(https?://|/)#', $video)) {
            throw new RuntimeException('لینک ویدیو باید با https:// شروع شود.');
        }
        $values = [
            'site'       => ['name' => $p('site_name', 60), 'nameFa' => $p('site_nameFa', 60), 'url' => $siteUrl, 'title' => $p('site_title', 150), 'description' => $p('site_description', 300)],
            'contact'    => ['phone' => $p('contact_phone', 40), 'email' => $p('contact_email', 150), 'whatsapp' => $p('contact_whatsapp', 40), 'address' => $p('contact_address', 300), 'hours' => $p('contact_hours', 150)],
            'hero'       => ['kicker' => $p('hero_kicker', 80), 'title' => $p('hero_title', 80), 'titleAccent' => $p('hero_titleAccent', 80), 'text' => $p('hero_text', 400)],
            'showcase'   => ['title' => $p('showcase_title', 80), 'text' => $p('showcase_text', 300)],
            'stats'      => array_map(fn($i) => ['value' => (string)(int)normalize_digits($p("stat{$i}_value", 10)), 'label' => $p("stat{$i}_label", 60), 'icon' => $icon("stat{$i}_icon")], [0, 1, 2]),
            'features'   => array_map(fn($i) => ['title' => $p("feat{$i}_title", 60), 'text' => $p("feat{$i}_text", 80), 'icon' => $icon("feat{$i}_icon")], [0, 1, 2]),
            'projects'   => ['title' => $p('projects_title', 80), 'text' => $p('projects_text', 300), 'image' => (string)s('projects.image'), 'video' => $video],
            'newsletter' => ['title' => $p('newsletter_title', 80), 'text' => $p('newsletter_text', 300)],
        ];
        if ($values['contact']['email'] !== '' && !filter_var($values['contact']['email'], FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('ایمیل تماس معتبر نیست.');
        }
        $q = $pdo->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        foreach ($values as $k => $v) {
            $q->execute([$k, json_encode($v, JSON_UNESCAPED_UNICODE)]);
        }
        admin_flash('تنظیمات ذخیره شد و روی سایت اعمال شد.');
        admin_redirect('s=settings');
    } catch (RuntimeException $ex) {
        $error = $ex->getMessage();
    }
}

$iconSelect = function (string $name, string $cur) use ($icons, $iconLabels): string {
    $o = '';
    foreach ($icons as $i) {
        if (isset($iconLabels[$i])) {
            $o .= '<option value="' . $i . '"' . ($i === $cur ? ' selected' : '') . '>' . $iconLabels[$i] . '</option>';
        }
    }
    return '<label class="f"><span>آیکن</span><select name="' . $name . '">' . $o . '</select></label>';
};

admin_page('تنظیمات سایت', 'settings', function () use ($error, $iconSelect) { ?>
  <div class="bar"><h1>تنظیمات سایت</h1><a class="btn btn-ghost btn-sm" href="/" target="_blank">مشاهده سایت ↗</a></div>
  <?php if ($error): ?><p class="flash flash-error"><?= e($error) ?></p><?php endif ?>
  <form class="form" method="post">
    <input type="hidden" name="csrf" value="<?= csrf() ?>">
    <fieldset>
      <legend>هویت سایت</legend>
      <?= field('نام لاتین', 'site_name', (string)s('site.name')) ?>
      <?= field('نام فارسی', 'site_nameFa', (string)s('site.nameFa')) ?>
      <?= field('آدرس سایت (دامنه)', 'site_url', (string)s('site.url'), ['dir' => 'ltr', 'placeholder' => 'https://pipeox.ir', 'hint' => 'برای لینک‌های canonical، نقشه سایت و تصویر اشتراک‌گذاری لازم است.']) ?>
      <?= field('عنوان صفحه اصلی (تب مرورگر و گوگل)', 'site_title', (string)s('site.title')) ?>
      <?= field('توضیح سایت (نتایج گوگل)', 'site_description', (string)s('site.description'), ['type' => 'textarea', 'rows' => 2, 'wide' => true]) ?>
    </fieldset>
    <fieldset>
      <legend>اطلاعات تماس</legend>
      <?= field('تلفن', 'contact_phone', (string)s('contact.phone'), ['dir' => 'ltr', 'placeholder' => '021-12345678']) ?>
      <?= field('ایمیل', 'contact_email', (string)s('contact.email'), ['dir' => 'ltr', 'type' => 'email']) ?>
      <?= field('واتساپ (با کد کشور)', 'contact_whatsapp', (string)s('contact.whatsapp'), ['dir' => 'ltr', 'placeholder' => '989121234567']) ?>
      <?= field('ساعات پاسخ‌گویی', 'contact_hours', (string)s('contact.hours'), ['placeholder' => 'شنبه تا چهارشنبه ۸ تا ۱۷']) ?>
      <?= field('نشانی', 'contact_address', (string)s('contact.address'), ['wide' => true]) ?>
      <p class="muted wide" style="margin:0">موارد خالی در سایت نمایش داده نمی‌شوند. تلفن در فوتر، صفحه تماس و پیام خطای فرم‌ها هم استفاده می‌شود.</p>
    </fieldset>
    <fieldset>
      <legend>صفحه اصلی — بخش اول</legend>
      <?= field('عبارت کوچک بالای تیتر', 'hero_kicker', (string)s('hero.kicker')) ?>
      <?= field('تیتر (خط اول)', 'hero_title', (string)s('hero.title')) ?>
      <?= field('تیتر (خط دوم، نارنجی)', 'hero_titleAccent', (string)s('hero.titleAccent')) ?>
      <?= field('متن', 'hero_text', (string)s('hero.text'), ['type' => 'textarea', 'rows' => 2, 'wide' => true]) ?>
    </fieldset>
    <fieldset>
      <legend>صفحه اصلی — آمار</legend>
      <p class="muted wide" style="margin:0">این اعداد ادعای رسمی شرکت‌اند؛ فقط ارقام قابل اثبات را وارد کنید.</p>
      <?php foreach (s('stats', []) + [[], [], []] as $i => $st): if ($i > 2) break; ?>
      <div class="wide form-3" style="display:grid;gap:14px 18px">
        <?= field('عدد ' . fa_digits($i + 1), "stat{$i}_value", (string)($st['value'] ?? ''), ['type' => 'number']) ?>
        <?= field('عنوان', "stat{$i}_label", (string)($st['label'] ?? '')) ?>
        <?= $iconSelect("stat{$i}_icon", (string)($st['icon'] ?? '')) ?>
      </div>
      <?php endforeach ?>
    </fieldset>
    <fieldset>
      <legend>صفحه اصلی — محصولات و ویژگی‌ها</legend>
      <?= field('عنوان بخش محصولات', 'showcase_title', (string)s('showcase.title')) ?>
      <?= field('متن بخش محصولات', 'showcase_text', (string)s('showcase.text')) ?>
      <?php foreach (s('features', []) + [[], [], []] as $i => $f): if ($i > 2) break; ?>
      <div class="wide form-3" style="display:grid;gap:14px 18px">
        <?= field('ویژگی ' . fa_digits($i + 1), "feat{$i}_title", (string)($f['title'] ?? '')) ?>
        <?= field('توضیح', "feat{$i}_text", (string)($f['text'] ?? '')) ?>
        <?= $iconSelect("feat{$i}_icon", (string)($f['icon'] ?? '')) ?>
      </div>
      <?php endforeach ?>
      <p class="muted wide" style="margin:0">ویژگی‌ها در صفحه «درباره ما» هم نمایش داده می‌شوند.</p>
    </fieldset>
    <fieldset>
      <legend>صفحه اصلی — پروژه‌ها و خبرنامه</legend>
      <?= field('عنوان کادر پروژه‌ها', 'projects_title', (string)s('projects.title')) ?>
      <?= field('لینک ویدیوی پروژه‌ها (اختیاری)', 'projects_video', (string)s('projects.video'), ['dir' => 'ltr', 'placeholder' => 'https://www.aparat.com/v/…', 'hint' => 'اگر خالی باشد، دکمه پخش به صفحه پروژه‌ها می‌رود.']) ?>
      <?= field('متن کادر پروژه‌ها', 'projects_text', (string)s('projects.text'), ['wide' => true]) ?>
      <?= field('عنوان خبرنامه (فوتر)', 'newsletter_title', (string)s('newsletter.title')) ?>
      <?= field('متن خبرنامه', 'newsletter_text', (string)s('newsletter.text')) ?>
    </fieldset>
    <div class="form-actions"><button>ذخیره تنظیمات</button></div>
  </form>
<?php });
