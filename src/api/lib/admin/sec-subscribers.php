<?php
/** Newsletter subscribers: list, remove, CSV export. */
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete'])) {
    $pdo->prepare('DELETE FROM subscribers WHERE id = ?')->execute([(int)$_POST['delete']]);
    admin_flash('ایمیل از خبرنامه حذف شد.');
    admin_redirect('s=subscribers');
}

if (isset($_GET['export'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pipeox-subscribers-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['ایمیل', 'تاریخ عضویت']);
    foreach ($pdo->query('SELECT email, created_at FROM subscribers ORDER BY id DESC') as $r) {
        fputcsv($out, [$r['email'], fa_date($r['created_at'])]);
    }
    exit;
}

$rows = $pdo->query('SELECT * FROM subscribers ORDER BY id DESC')->fetchAll();

admin_page('خبرنامه', 'subscribers', function () use ($rows) { ?>
  <div class="bar">
    <h1>مشترکان خبرنامه (<?= fa_digits(count($rows)) ?>)</h1>
    <div class="tools"><a class="btn btn-ghost btn-sm" href="?s=subscribers&export=1">خروجی Excel</a></div>
  </div>
  <?php if (!$rows): ?><p class="empty">هنوز کسی عضو خبرنامه نشده است.</p><?php else: ?>
  <table class="table">
    <tr><th>ایمیل</th><th>تاریخ عضویت</th><th></th></tr>
    <?php foreach ($rows as $r): ?>
    <tr>
      <td dir="ltr" style="text-align:right"><?= e($r['email']) ?></td>
      <td><?= fa_datetime($r['created_at']) ?></td>
      <td class="actions"><form method="post" data-confirm="این ایمیل از خبرنامه حذف شود؟"><input type="hidden" name="csrf" value="<?= csrf() ?>"><input type="hidden" name="delete" value="<?= $r['id'] ?>"><button class="btn-danger btn-sm">حذف</button></form></td>
    </tr>
    <?php endforeach ?>
  </table>
  <?php endif ?>
<?php });
