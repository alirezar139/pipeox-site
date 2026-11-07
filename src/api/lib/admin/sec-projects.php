<?php
/** Projects shown on /projects/ (the "پروژه‌های شاخص" section appears once there is at least one). */
$pdo = db();
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['delete'])) {
        $pdo->prepare('DELETE FROM projects WHERE id = ?')->execute([(int)$_POST['delete']]);
        admin_flash('پروژه حذف شد.');
        admin_redirect('s=projects');
    }
    try {
        $cur = $id ? $pdo->query('SELECT image FROM projects WHERE id = ' . (int)$id)->fetchColumn() : '';
        $d = [
            'title'     => post_str('title', 200),
            'client'    => post_str('client', 150),
            'year'      => normalize_digits(post_str('year', 20)),
            'industry'  => post_str('industry', 100),
            'scope'     => post_str('scope', 2000),
            'image'     => image_input('image', (string)$cur),
            'sort'      => (int)($_POST['sort'] ?? 0),
            'published' => isset($_POST['published']) ? 1 : 0,
        ];
        if (mb_strlen($d['title']) < 2) {
            throw new RuntimeException('عنوان پروژه را وارد کنید.');
        }
        $cols = array_keys($d);
        if ($id) {
            $pdo->prepare('UPDATE projects SET ' . implode(', ', array_map(fn($c) => "$c = ?", $cols)) . ' WHERE id = ?')->execute([...array_values($d), $id]);
        } else {
            $pdo->prepare('INSERT INTO projects (' . implode(', ', $cols) . ') VALUES (' . rtrim(str_repeat('?, ', count($cols)), ', ') . ')')->execute(array_values($d));
            $id = (int)$pdo->lastInsertId();
        }
        admin_flash('پروژه ذخیره شد.');
        admin_redirect('s=projects');
    } catch (RuntimeException $ex) {
        $error = $ex->getMessage();
    }
}

if ($id === null) {
    $rows = $pdo->query('SELECT * FROM projects ORDER BY sort, id')->fetchAll();
    admin_page('پروژه‌ها', 'projects', function () use ($rows) { ?>
      <div class="bar"><h1>پروژه‌ها</h1><a class="btn" href="?s=projects&id=0">+ پروژه جدید</a></div>
      <?php if (!$rows): ?><p class="empty">هنوز پروژه‌ای ثبت نشده است. بخش «پروژه‌های شاخص» صفحه پروژه‌ها بعد از ثبت اولین پروژه نمایش داده می‌شود.</p><?php else: ?>
      <table class="table">
        <tr><th></th><th>عنوان</th><th>کارفرما</th><th>صنعت</th><th>سال</th><th>وضعیت</th><th></th></tr>
        <?php foreach ($rows as $r): ?>
        <tr>
          <td><?php if ($r['image']): ?><img src="<?= e($r['image']) ?>" alt=""><?php endif ?></td>
          <td><a href="?s=projects&id=<?= $r['id'] ?>"><b><?= e($r['title']) ?></b></a></td>
          <td><?= e($r['client']) ?></td><td><?= e($r['industry']) ?></td><td><?= e(fa_digits($r['year'])) ?></td>
          <td><?= $r['published'] ? '<span class="pill pill-on">نمایش</span>' : '<span class="pill pill-off">مخفی</span>' ?></td>
          <td class="actions"><a class="btn btn-ghost btn-sm" href="?s=projects&id=<?= $r['id'] ?>">ویرایش</a></td>
        </tr>
        <?php endforeach ?>
      </table>
      <?php endif ?>
    <?php });
    return;
}

$row = $id ? $pdo->query('SELECT * FROM projects WHERE id = ' . $id)->fetch() : null;
if ($id && !$row) {
    admin_redirect('s=projects');
}
$r = $row ?? ['title' => '', 'client' => '', 'year' => '', 'industry' => '', 'scope' => '', 'image' => '', 'sort' => 0, 'published' => 1];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach (['title', 'client', 'year', 'industry', 'scope'] as $k) {
        $r[$k] = (string)($_POST[$k] ?? '');
    }
}

admin_page($id ? 'ویرایش پروژه' : 'پروژه جدید', 'projects', function () use ($r, $id, $error) { ?>
  <div class="bar"><h1><?= $id ? 'ویرایش: ' . e($r['title']) : 'پروژه جدید' ?></h1><a class="btn btn-ghost btn-sm" href="?s=projects">← بازگشت</a></div>
  <?php if ($error): ?><p class="flash flash-error"><?= e($error) ?></p><?php endif ?>
  <form class="form" method="post" enctype="multipart/form-data">
    <input type="hidden" name="csrf" value="<?= csrf() ?>">
    <?= field('عنوان پروژه', 'title', $r['title'], ['required' => true, 'wide' => true]) ?>
    <?= field('کارفرما', 'client', $r['client']) ?>
    <?= field('صنعت', 'industry', $r['industry'], ['placeholder' => 'مثلاً نفت و گاز']) ?>
    <?= field('سال', 'year', $r['year'], ['placeholder' => '۱۴۰۳']) ?>
    <?= field('ترتیب نمایش', 'sort', (string)$r['sort'], ['type' => 'number']) ?>
    <?= field('شرح کار و اقلام تأمین‌شده', 'scope', $r['scope'], ['type' => 'textarea', 'rows' => 4, 'wide' => true]) ?>
    <?= image_field('تصویر', 'image', $r['image']) ?>
    <?= checkbox('در سایت نمایش داده شود', 'published', (bool)$r['published']) ?>
    <div class="form-actions"><button>ذخیره پروژه</button></div>
  </form>
  <?php if ($id): ?>
  <form method="post" data-confirm="این پروژه حذف شود؟" style="margin-top:14px">
    <input type="hidden" name="csrf" value="<?= csrf() ?>"><input type="hidden" name="delete" value="<?= $id ?>">
    <button class="btn-danger btn-sm">حذف پروژه</button>
  </form>
  <?php endif ?>
<?php });
