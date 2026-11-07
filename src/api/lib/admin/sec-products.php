<?php
/** Products: list, add, edit, delete. The homepage orbit shows the four products placed on a–d. */
$pdo = db();
$id = isset($_GET['id']) ? (int)$_GET['id'] : null; // 0 = new
$orbitSlots = ['' => '— نمایش داده نشود —', 'a' => 'بالا راست (کنار لوله‌ها)', 'b' => 'بالا چپ (کنار فلنج)', 'c' => 'پایین چپ (کنار زانویی)', 'd' => 'پایین راست (کنار شیر)'];
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['delete'])) {
        $pdo->prepare('DELETE FROM products WHERE id = ?')->execute([(int)$_POST['delete']]);
        admin_flash('محصول حذف شد.');
        admin_redirect('s=products');
    }
    try {
        $cur = $id ? $pdo->query('SELECT image FROM products WHERE id = ' . (int)$id)->fetchColumn() : '';
        $d = [
            'title'        => post_str('title', 150),
            'slug'         => slugify(post_str('slug', 80)),
            'short_title'  => post_str('short_title', 40),
            'code'         => post_str('code', 60),
            'summary'      => post_str('summary', 400),
            'intro'        => post_str('intro', 3000),
            'image'        => image_input('image', (string)$cur),
            'alt'          => post_str('alt', 150),
            'keywords'     => post_str('keywords', 500),
            'orbit'        => array_key_exists($_POST['orbit'] ?? '', $orbitSlots) ? (string)$_POST['orbit'] : '',
            'types'        => json_encode(array_map(fn($r) => ['name' => $r[0], 'desc' => $r[1]], parse_lines(post_str('types', 5000))), JSON_UNESCAPED_UNICODE),
            'specs'        => json_encode(parse_lines(post_str('specs', 5000)), JSON_UNESCAPED_UNICODE),
            'applications' => json_encode(parse_lines(post_str('applications', 3000), 1), JSON_UNESCAPED_UNICODE),
            'sort'         => (int)($_POST['sort'] ?? 0),
            'published'    => isset($_POST['published']) ? 1 : 0,
        ];
        if (mb_strlen($d['title']) < 2) {
            throw new RuntimeException('عنوان محصول را وارد کنید.');
        }
        if ($d['slug'] === '') {
            throw new RuntimeException('نامک (آدرس) لاتین محصول را وارد کنید؛ مثلاً steel-pipes');
        }
        $dup = $pdo->prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?');
        $dup->execute([$d['slug'], (int)$id]);
        if ($dup->fetchColumn()) {
            throw new RuntimeException('این نامک برای محصول دیگری استفاده شده است.');
        }
        if ($d['orbit'] !== '') {
            // one product per orbit slot
            $pdo->prepare("UPDATE products SET orbit = '' WHERE orbit = ? AND id != ?")->execute([$d['orbit'], (int)$id]);
        }
        $cols = array_keys($d);
        if ($id) {
            $pdo->prepare('UPDATE products SET ' . implode(', ', array_map(fn($c) => "$c = ?", $cols)) . ", updated_at = datetime('now') WHERE id = ?")
                ->execute([...array_values($d), $id]);
        } else {
            $pdo->prepare('INSERT INTO products (' . implode(', ', $cols) . ') VALUES (' . rtrim(str_repeat('?, ', count($cols)), ', ') . ')')
                ->execute(array_values($d));
            $id = (int)$pdo->lastInsertId();
        }
        admin_flash('محصول ذخیره شد.');
        admin_redirect('s=products&id=' . $id);
    } catch (RuntimeException $ex) {
        $error = $ex->getMessage();
    }
}

if ($id === null) {
    $rows = $pdo->query('SELECT * FROM products ORDER BY sort, id')->fetchAll();
    admin_page('محصولات', 'products', function () use ($rows, $orbitSlots) { ?>
      <div class="bar"><h1>محصولات</h1><a class="btn" href="?s=products&id=0">+ محصول جدید</a></div>
      <?php if (!$rows): ?><p class="empty">هنوز محصولی ثبت نشده است.</p><?php else: ?>
      <table class="table">
        <tr><th></th><th>عنوان</th><th>آدرس</th><th>صفحه اصلی</th><th>ترتیب</th><th>وضعیت</th><th></th></tr>
        <?php foreach ($rows as $r): ?>
        <tr>
          <td><?php if ($r['image']): ?><img src="<?= e($r['image']) ?>" alt=""><?php endif ?></td>
          <td><a href="?s=products&id=<?= $r['id'] ?>"><b><?= e($r['title']) ?></b></a><br><small class="muted"><?= e($r['code']) ?></small></td>
          <td dir="ltr" class="muted">/products/<?= e($r['slug']) ?>/</td>
          <td><?= $r['orbit'] ? '<span class="pill pill-orange">' . e($orbitSlots[$r['orbit']] ?? $r['orbit']) . '</span>' : '<span class="muted">—</span>' ?></td>
          <td><?= (int)$r['sort'] ?></td>
          <td><?= $r['published'] ? '<span class="pill pill-on">منتشر شده</span>' : '<span class="pill pill-off">پیش‌نویس</span>' ?></td>
          <td class="actions">
            <a class="btn btn-ghost btn-sm" href="?s=products&id=<?= $r['id'] ?>">ویرایش</a>
            <?php if ($r['published']): ?><a class="btn btn-ghost btn-sm" href="/products/<?= e($r['slug']) ?>/" target="_blank">مشاهده</a><?php endif ?>
          </td>
        </tr>
        <?php endforeach ?>
      </table>
      <?php endif ?>
    <?php });
    return;
}

$row = $id ? $pdo->query('SELECT * FROM products WHERE id = ' . $id)->fetch() : null;
if ($id && !$row) {
    admin_redirect('s=products');
}
if ($row) {
    $row = product_row($row);
}
// On a failed save, show what was typed
$v = fn(string $k, string $def = '') => $_SERVER['REQUEST_METHOD'] === 'POST' ? (string)($_POST[$k] ?? $def) : $def;
$r = $row ?? ['title' => '', 'slug' => '', 'short_title' => '', 'code' => '', 'summary' => '', 'intro' => '', 'image' => '', 'alt' => '',
    'keywords' => '', 'orbit' => '', 'types' => [], 'specs' => [], 'applications' => [], 'sort' => 0, 'published' => 1];
$typesText = implode("\n", array_map(fn($t) => $t['name'] . ' | ' . $t['desc'], $r['types']));
$specsText = implode("\n", array_map(fn($s) => $s[0] . ' | ' . $s[1], $r['specs']));

admin_page($id ? 'ویرایش محصول' : 'محصول جدید', 'products', function () use ($r, $id, $v, $typesText, $specsText, $orbitSlots, $error) { ?>
  <div class="bar">
    <h1><?= $id ? 'ویرایش: ' . e($r['title']) : 'محصول جدید' ?></h1>
    <div class="tools">
      <?php if ($id && $r['published']): ?><a class="btn btn-ghost btn-sm" href="/products/<?= e($r['slug']) ?>/" target="_blank">مشاهده در سایت ↗</a><?php endif ?>
      <a class="btn btn-ghost btn-sm" href="?s=products">← بازگشت</a>
    </div>
  </div>
  <?php if ($error): ?><p class="flash flash-error"><?= e($error) ?></p><?php endif ?>
  <form class="form" method="post" enctype="multipart/form-data">
    <input type="hidden" name="csrf" value="<?= csrf() ?>">
    <fieldset>
      <legend>اطلاعات اصلی</legend>
      <?= field('عنوان', 'title', $v('title', $r['title']), ['required' => true]) ?>
      <?= field('نامک (آدرس صفحه)', 'slug', $v('slug', $r['slug']), ['dir' => 'ltr', 'required' => true, 'hint' => 'فقط حروف انگلیسی کوچک، عدد و خط تیره — /products/<b>نامک</b>/']) ?>
      <?= field('عنوان کوتاه', 'short_title', $v('short_title', $r['short_title']), ['hint' => 'روی برچسب‌های صفحه اصلی؛ مثلاً «لوله‌ها»']) ?>
      <?= field('کد / زیرعنوان لاتین', 'code', $v('code', $r['code']), ['dir' => 'ltr', 'placeholder' => 'STEEL PIPES']) ?>
      <?= field('خلاصه (کارت محصول)', 'summary', $v('summary', $r['summary']), ['type' => 'textarea', 'rows' => 2, 'wide' => true]) ?>
      <?= field('معرفی (صفحه محصول)', 'intro', $v('intro', $r['intro']), ['type' => 'textarea', 'rows' => 4, 'wide' => true]) ?>
      <?= image_field('تصویر', 'image', $r['image']) ?>
      <?= field('متن جایگزین تصویر', 'alt', $v('alt', $r['alt'])) ?>
      <?= field('کلیدواژه‌های جستجو', 'keywords', $v('keywords', $r['keywords']), ['hint' => 'با فاصله جدا کنید؛ جستجوی بالای سایت از این‌ها استفاده می‌کند']) ?>
    </fieldset>
    <fieldset>
      <legend>مشخصات فنی</legend>
      <?= field('انواع', 'types', $v('types', $typesText), ['type' => 'textarea', 'rows' => 5, 'wide' => true, 'hint' => 'هر خط یک نوع: <b>نام | توضیح</b>']) ?>
      <?= field('جدول مشخصات', 'specs', $v('specs', $specsText), ['type' => 'textarea', 'rows' => 6, 'wide' => true, 'hint' => 'هر خط یک ردیف: <b>عنوان | مقدار</b>']) ?>
      <?= field('کاربردها', 'applications', $v('applications', implode("\n", $r['applications'])), ['type' => 'textarea', 'rows' => 4, 'wide' => true, 'hint' => 'هر خط یک کاربرد']) ?>
    </fieldset>
    <fieldset>
      <legend>نمایش</legend>
      <label class="f"><span>جایگاه در تصویر صفحه اصلی</span>
        <select name="orbit">
          <?php foreach ($orbitSlots as $k => $label): ?><option value="<?= $k ?>"<?= $v('orbit', $r['orbit']) === $k ? ' selected' : '' ?>><?= $label ?></option><?php endforeach ?>
        </select>
        <small>تصویر صفحه اصلی چهار جایگاه ثابت دارد؛ هر جایگاه فقط یک محصول.</small>
      </label>
      <?= field('ترتیب نمایش', 'sort', (string)$v('sort', (string)$r['sort']), ['type' => 'number', 'hint' => 'عدد کمتر = جلوتر']) ?>
      <?= checkbox('منتشر شود', 'published', (bool)$r['published']) ?>
    </fieldset>
    <div class="form-actions"><button>ذخیره محصول</button></div>
  </form>
  <?php if ($id): ?>
  <form method="post" data-confirm="این محصول برای همیشه حذف شود؟" style="margin-top:14px">
    <input type="hidden" name="csrf" value="<?= csrf() ?>"><input type="hidden" name="delete" value="<?= $id ?>">
    <button class="btn-danger btn-sm">حذف محصول</button>
  </form>
  <?php endif ?>
<?php });
