<?php
/** Articles & news: list, write (rich-text editor), publish/schedule, delete. Body HTML is sanitized on save. */
$pdo = db();
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['delete'])) {
        $pdo->prepare('DELETE FROM articles WHERE id = ?')->execute([(int)$_POST['delete']]);
        admin_flash('مطلب حذف شد.');
        admin_redirect('s=articles');
    }
    try {
        $cur = $id ? $pdo->query('SELECT image FROM articles WHERE id = ' . (int)$id)->fetchColumn() : '';
        $date = (string)($_POST['published_at'] ?? '');
        $d = [
            'title'        => post_str('title', 200),
            'slug'         => slugify(post_str('slug', 80)),
            'description'  => post_str('description', 400),
            'category'     => post_str('category', 60),
            'image'        => image_input('image', (string)$cur),
            'image_alt'    => post_str('image_alt', 150),
            'show_cover'   => isset($_POST['show_cover']) ? 1 : 0,
            'body'         => sanitize_html((string)($_POST['body'] ?? '')),
            'published_at' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : date('Y-m-d'),
            'published'    => isset($_POST['published']) ? 1 : 0,
        ];
        if (mb_strlen($d['title']) < 3) {
            throw new RuntimeException('عنوان مطلب را وارد کنید.');
        }
        if ($d['slug'] === '') {
            $d['slug'] = 'post-' . date('ymd') . '-' . bin2hex(random_bytes(2));
        }
        $dup = $pdo->prepare('SELECT 1 FROM articles WHERE slug = ? AND id != ?');
        $dup->execute([$d['slug'], (int)$id]);
        if ($dup->fetchColumn()) {
            throw new RuntimeException('این نامک برای مطلب دیگری استفاده شده است.');
        }
        $cols = array_keys($d);
        if ($id) {
            $pdo->prepare('UPDATE articles SET ' . implode(', ', array_map(fn($c) => "$c = ?", $cols)) . ", updated_at = datetime('now') WHERE id = ?")
                ->execute([...array_values($d), $id]);
        } else {
            $pdo->prepare('INSERT INTO articles (' . implode(', ', $cols) . ') VALUES (' . rtrim(str_repeat('?, ', count($cols)), ', ') . ')')
                ->execute(array_values($d));
            $id = (int)$pdo->lastInsertId();
        }
        admin_flash('مطلب ذخیره شد.');
        admin_redirect('s=articles&id=' . $id);
    } catch (RuntimeException $ex) {
        $error = $ex->getMessage();
    }
}

if ($id === null) {
    $rows = $pdo->query('SELECT id, slug, title, category, image, published, published_at FROM articles ORDER BY published_at DESC, id DESC')->fetchAll();
    admin_page('مقالات و اخبار', 'articles', function () use ($rows) { ?>
      <div class="bar"><h1>مقالات و اخبار</h1><a class="btn" href="?s=articles&id=0">+ مطلب جدید</a></div>
      <p class="muted">آخرین مطلب منتشرشده در کادر «آخرین اخبار و اطلاعیه‌ها»ی صفحه اصلی نمایش داده می‌شود.</p>
      <?php if (!$rows): ?><p class="empty">هنوز مطلبی ننوشته‌اید.</p><?php else: ?>
      <table class="table">
        <tr><th></th><th>عنوان</th><th>دسته</th><th>تاریخ انتشار</th><th>وضعیت</th><th></th></tr>
        <?php foreach ($rows as $r): $future = $r['published_at'] > today(); ?>
        <tr>
          <td><?php if ($r['image']): ?><img src="<?= e($r['image']) ?>" alt=""><?php endif ?></td>
          <td><a href="?s=articles&id=<?= $r['id'] ?>"><b><?= e($r['title']) ?></b></a></td>
          <td><?= e($r['category']) ?></td>
          <td><?= fa_date($r['published_at']) ?></td>
          <td><?= !$r['published'] ? '<span class="pill pill-off">پیش‌نویس</span>' : ($future ? '<span class="pill pill-orange">زمان‌بندی‌شده</span>' : '<span class="pill pill-on">منتشر شده</span>') ?></td>
          <td class="actions">
            <a class="btn btn-ghost btn-sm" href="?s=articles&id=<?= $r['id'] ?>">ویرایش</a>
            <?php if ($r['published'] && !$future): ?><a class="btn btn-ghost btn-sm" href="/insights/<?= e($r['slug']) ?>/" target="_blank">مشاهده</a><?php endif ?>
          </td>
        </tr>
        <?php endforeach ?>
      </table>
      <?php endif ?>
    <?php });
    return;
}

$row = $id ? $pdo->query('SELECT * FROM articles WHERE id = ' . $id)->fetch() : null;
if ($id && !$row) {
    admin_redirect('s=articles');
}
$posted = $_SERVER['REQUEST_METHOD'] === 'POST';
$r = $row ?? ['title' => '', 'slug' => '', 'description' => '', 'category' => '', 'image' => '', 'image_alt' => '', 'show_cover' => 1,
    'body' => '', 'published_at' => date('Y-m-d'), 'published' => 1];
if ($posted) {
    foreach (['title', 'slug', 'description', 'category', 'image_alt', 'published_at'] as $k) {
        $r[$k] = (string)($_POST[$k] ?? $r[$k]);
    }
    $r['body'] = sanitize_html((string)($_POST['body'] ?? ''));
}
$cats = $pdo->query("SELECT DISTINCT category FROM articles WHERE category != '' ORDER BY category")->fetchAll(PDO::FETCH_COLUMN);

admin_page($id ? 'ویرایش مطلب' : 'مطلب جدید', 'articles', function () use ($r, $id, $error, $cats) { ?>
  <div class="bar">
    <h1><?= $id ? 'ویرایش: ' . e($r['title']) : 'مطلب جدید' ?></h1>
    <div class="tools">
      <?php if ($id && $r['published']): ?><a class="btn btn-ghost btn-sm" href="/insights/<?= e($r['slug']) ?>/" target="_blank">مشاهده در سایت ↗</a><?php endif ?>
      <a class="btn btn-ghost btn-sm" href="?s=articles">← بازگشت</a>
    </div>
  </div>
  <?php if ($error): ?><p class="flash flash-error"><?= e($error) ?></p><?php endif ?>
  <form class="form" method="post" enctype="multipart/form-data" id="articleForm">
    <input type="hidden" name="csrf" value="<?= csrf() ?>">
    <?= field('عنوان', 'title', $r['title'], ['required' => true, 'wide' => true]) ?>
    <?= field('خلاصه', 'description', $r['description'], ['type' => 'textarea', 'rows' => 2, 'wide' => true, 'hint' => 'در فهرست مطالب و نتایج گوگل نمایش داده می‌شود (حدود ۱۵۰ کاراکتر)']) ?>
    <div class="f wide"><span>متن مطلب</span>
      <div class="editor" id="editor">
        <div class="ed-tools">
          <button type="button" data-cmd="formatBlock" data-arg="h2" title="تیتر">تیتر</button>
          <button type="button" data-cmd="formatBlock" data-arg="h3" title="زیرتیتر">زیرتیتر</button>
          <button type="button" data-cmd="formatBlock" data-arg="p" title="پاراگراف">متن</button>
          <span class="sep"></span>
          <button type="button" data-cmd="bold" title="پررنگ"><b>B</b></button>
          <button type="button" data-cmd="italic" title="کج"><i>I</i></button>
          <button type="button" data-cmd="insertUnorderedList" title="فهرست">• فهرست</button>
          <button type="button" data-cmd="insertOrderedList" title="فهرست شماره‌دار">۱. فهرست</button>
          <button type="button" data-cmd="formatBlock" data-arg="blockquote" title="نقل‌قول">❝ نقل‌قول</button>
          <span class="sep"></span>
          <button type="button" data-act="link" title="پیوند">🔗 پیوند</button>
          <button type="button" data-act="image" title="تصویر">🖼 تصویر</button>
          <button type="button" data-cmd="removeFormat" title="حذف قالب">پاک‌کردن قالب</button>
          <span class="sep"></span>
          <button type="button" data-act="source" title="ویرایش HTML">&lt;/&gt; HTML</button>
        </div>
        <div class="ed-area" contenteditable="true" dir="rtl"><?= $r['body'] ?></div>
        <textarea class="ed-source" spellcheck="false"></textarea>
      </div>
      <textarea name="body" hidden></textarea>
      <input type="file" id="edImage" accept="image/jpeg,image/png,image/webp" hidden>
    </div>
    <fieldset>
      <legend>انتشار</legend>
      <label class="f"><span>دسته</span><input name="category" value="<?= e($r['category']) ?>" list="cats" placeholder="مثلاً راهنمای فنی"><datalist id="cats"><?php foreach ($cats as $c): ?><option value="<?= e($c) ?>"><?php endforeach ?></datalist></label>
      <?= field('تاریخ انتشار (میلادی)', 'published_at', $r['published_at'], ['type' => 'date', 'hint' => 'روی سایت به شمسی نمایش داده می‌شود: <b>' . fa_date($r['published_at'] ?: date('Y-m-d')) . '</b>. تاریخ آینده = انتشار خودکار در آن روز.']) ?>
      <?= field('نامک (آدرس)', 'slug', $r['slug'], ['dir' => 'ltr', 'hint' => 'حروف انگلیسی، عدد و خط تیره. خالی بگذارید تا خودکار ساخته شود.']) ?>
      <?= checkbox('منتشر شود', 'published', (bool)$r['published']) ?>
    </fieldset>
    <fieldset>
      <legend>تصویر</legend>
      <?= image_field('تصویر شاخص', 'image', $r['image']) ?>
      <?= field('متن جایگزین تصویر', 'image_alt', $r['image_alt']) ?>
      <?= checkbox('تصویر بالای متن مطلب هم نمایش داده شود', 'show_cover', (bool)$r['show_cover']) ?>
    </fieldset>
    <div class="form-actions"><button>ذخیره مطلب</button></div>
  </form>
  <?php if ($id): ?>
  <form method="post" data-confirm="این مطلب برای همیشه حذف شود؟" style="margin-top:14px">
    <input type="hidden" name="csrf" value="<?= csrf() ?>"><input type="hidden" name="delete" value="<?= $id ?>">
    <button class="btn-danger btn-sm">حذف مطلب</button>
  </form>
  <?php endif ?>
  <script>
  (() => {
    const ed = document.getElementById("editor");
    const area = ed.querySelector(".ed-area");
    const src = ed.querySelector(".ed-source");
    const form = document.getElementById("articleForm");
    const fileIn = document.getElementById("edImage");
    const csrf = <?= json_encode(csrf()) ?>;
    document.execCommand("defaultParagraphSeparator", false, "p");

    ed.querySelector(".ed-tools").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.cmd) {
        area.focus();
        document.execCommand(b.dataset.cmd, false, b.dataset.arg ? `<${b.dataset.arg}>` : null);
      } else if (b.dataset.act === "link") {
        const url = prompt("آدرس پیوند (https://… یا /products/…):");
        if (url) { area.focus(); document.execCommand("createLink", false, url); }
      } else if (b.dataset.act === "image") {
        fileIn.click();
      } else if (b.dataset.act === "source") {
        if (ed.classList.toggle("source")) src.value = area.innerHTML;
        else area.innerHTML = src.value;
      }
    });

    let savedRange = null;
    area.addEventListener("blur", () => {
      const sel = getSelection();
      if (sel.rangeCount) savedRange = sel.getRangeAt(0);
    });
    fileIn.addEventListener("change", async () => {
      const f = fileIn.files[0];
      if (!f) return;
      const data = new FormData();
      data.append("image", f);
      data.append("csrf", csrf);
      const res = await fetch("?s=upload", { method: "POST", body: data });
      const json = await res.json().catch(() => ({}));
      fileIn.value = "";
      if (!res.ok) return alert(json.error || "بارگذاری ناموفق بود.");
      area.focus();
      if (savedRange) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
      const alt = prompt("توضیح کوتاه تصویر (برای دسترس‌پذیری و سئو):") || "";
      const img = document.createElement("img");
      img.src = json.url; img.alt = alt;
      document.execCommand("insertHTML", false, img.outerHTML);
    });

    // Pasted content: keep text structure, drop Word/website styling
    area.addEventListener("paste", (e) => {
      const html = e.clipboardData.getData("text/html");
      if (!html) return;
      e.preventDefault();
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      tmp.querySelectorAll("style,script,meta,link").forEach((n) => n.remove());
      tmp.querySelectorAll("*").forEach((n) => { [...n.attributes].forEach((a) => { if (!["href", "src", "alt"].includes(a.name)) n.removeAttribute(a.name); }); });
      document.execCommand("insertHTML", false, tmp.innerHTML);
    });

    form.addEventListener("submit", () => {
      form.elements.body.value = ed.classList.contains("source") ? src.value : area.innerHTML;
    });
  })();
  </script>
<?php });
